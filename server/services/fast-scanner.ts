/**
 * Fast Scanner Service
 * Two-phase scanning: Quick scan + Background processing for 50 tracked assets
 * 
 * Phase 1: Fast Scan (5-10 seconds)
 *   - Fetch latest prices
 *   - Calculate basic indicators (RSI, MACD, EMA)
 *   - Generate initial signals
 *   - Return to frontend immediately
 * 
 * Phase 2: Background Processing (runs after)
 *   - Deep technical analysis
 *   - ML predictions
 *   - Complex scoring
 *   - State tracking
 */

import axios from 'axios';
import { EventEmitter } from 'events';
import { ALL_TRACKED_ASSETS } from '@shared/tracked-assets';

interface QuickSignal {
  symbol: string;
  exchange: string;
  price: number;
  change24h: number;
  signal: 'BUY' | 'SELL' | 'HOLD';
  strength: number;
  rsi: number;
  macd: string;
  timestamp: Date;
  scanId: string;
  status: 'quick_scan' | 'analyzing' | 'complete';
}

interface DeepAnalysis {
  scanId: string;
  symbol: string;
  opportunity_score?: number;
  market_regime?: any;
  sl_tp?: any;
  confluence?: any;
  ml_prediction?: any;
  timestamp: Date;
}

class FastScannerService extends EventEmitter {
  private scanResults: Map<string, QuickSignal> = new Map();
  private deepAnalysis: Map<string, DeepAnalysis> = new Map();
  private currentScanId: string | null = null;
  private isScanning: boolean = false;
  private backgroundQueue: string[] = [];
  private scanHistory: Array<{scanId: string; timestamp: Date; symbolCount: number}> = [];
  
  private readonly SCANNER_API_URL = process.env.SCANNER_API_URL || 'http://localhost:5001';
  private readonly SCAN_INTERVAL = 15 * 60 * 1000; // 15 minutes
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startPeriodicScanning();
  }

  /**
   * Phase 1: Quick Scan - Get initial signals fast
   */
  async quickScan(symbols?: string[]): Promise<QuickSignal[]> {
    if (this.isScanning) {
      console.log('[FastScanner] Scan already in progress');
      return Array.from(this.scanResults.values());
    }

    this.isScanning = true;
    this.currentScanId = `scan_${Date.now()}`;
    const scanId = this.currentScanId;

    console.log(`[FastScanner] Starting quick scan ${scanId}`);
    const startTime = Date.now();

    try {
      // Get symbols to scan (all 50 tracked assets if not specified)
      const symbolsToScan = symbols || ALL_TRACKED_ASSETS.map(a => `${a.symbol}/USDT`);

      // Quick parallel fetch with timeout
      const quickResults = await this.fetchQuickData(symbolsToScan, scanId);
      
      // Store results
      quickResults.forEach(signal => {
        this.scanResults.set(signal.symbol, signal);
      });

      const scanTime = Date.now() - startTime;
      console.log(`[FastScanner] Quick scan completed in ${scanTime}ms - ${quickResults.length} symbols`);

      // Record scan history
      this.scanHistory.push({
        scanId,
        timestamp: new Date(),
        symbolCount: quickResults.length
      });

      // Keep only last 10 scans in history
      if (this.scanHistory.length > 10) {
        this.scanHistory.shift();
      }

      // Emit quick results immediately
      this.emit('quickScanComplete', {
        scanId,
        signals: quickResults,
        scanTime,
        timestamp: new Date()
      });

      // Phase 2: Queue background processing
      this.queueBackgroundAnalysis(quickResults.map(s => s.symbol), scanId);

      return quickResults;

    } catch (error) {
      console.error('[FastScanner] Quick scan failed:', error);
      throw error;
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Fetch quick data from multiple sources in parallel
   */
  private async fetchQuickData(symbols: string[], scanId: string): Promise<QuickSignal[]> {
    try {
      // Call Python scanner API once for all symbols
      console.log(`[FastScanner] Calling scanner API for ${symbols.length} symbols`);
      const response = await axios.post(`${this.SCANNER_API_URL}/api/scanner/scan`, {
        timeframe: '1h',
        exchange: 'kucoinfutures',
        signal: 'all',
        minStrength: 0,
        fullAnalysis: false // Quick mode
      }, {
        timeout: 120000 // 120 second timeout (2 minutes) for full market scan
      });

      if (response.data && response.data.signals) {
        console.log(`[FastScanner] Scanner API returned ${response.data.signals.length} signals`);
        
        // Filter results to match requested symbols
        const symbolSet = new Set(symbols);
        const matchedSignals = response.data.signals.filter((signal: any) => 
          symbolSet.has(signal.symbol)
        );

        // Map scanner API response to QuickSignal format
        const results: QuickSignal[] = matchedSignals.map((scannerSignal: any) => ({
          symbol: scannerSignal.symbol,
          exchange: scannerSignal.exchange || 'kucoinfutures',
          price: scannerSignal.price,
          change24h: scannerSignal.change || 0,
          signal: scannerSignal.signal as 'BUY' | 'SELL' | 'HOLD',
          strength: scannerSignal.strength || 50,
          rsi: scannerSignal.indicators?.rsi || scannerSignal.rsi || 50,
          macd: scannerSignal.indicators?.macd || scannerSignal.macd_signal || 'neutral',
          timestamp: new Date(),
          scanId,
          status: 'quick_scan'
        }));

        // For symbols not in API results, generate fallback data
        const returnedSymbols = new Set(results.map(r => r.symbol));
        const missingSymbols = symbols.filter(s => !returnedSymbols.has(s));
        
        if (missingSymbols.length > 0) {
          console.log(`[FastScanner] ${missingSymbols.length} symbols not in API results, using fallback`);
          missingSymbols.forEach(symbol => {
            results.push(this.generateFallbackSignal(symbol, scanId));
          });
        }

        return results;
      }

      console.error('[FastScanner] No signals in API response');
      throw new Error('Scanner API returned no signals');

    } catch (error: any) {
      console.error('[FastScanner] Scanner API call failed:', error.message);
      throw new Error(`Scanner API unavailable: ${error.message}`);
    }
  }

  /**
   * Generate fallback signal data when API is unavailable
   */
  private generateFallbackSignal(symbol: string, scanId: string): QuickSignal {
    // Return empty/error state instead of mock data
    throw new Error(`Scanner API unavailable for ${symbol}. No fallback data.`);
  }

  /**
   * Phase 2: Queue symbols for background deep analysis
   */
  private queueBackgroundAnalysis(symbols: string[], scanId: string) {
    console.log(`[FastScanner] Queueing ${symbols.length} symbols for deep analysis`);
    this.backgroundQueue.push(...symbols);
    
    // Start processing queue
    this.processBackgroundQueue(scanId);
  }

  /**
   * Process background analysis queue
   */
  private async processBackgroundQueue(scanId: string) {
    if (this.backgroundQueue.length === 0) {
      console.log('[FastScanner] Background queue empty');
      this.emit('deepAnalysisComplete', { scanId, timestamp: new Date() });
      return;
    }

    // Process 2 symbols at a time to avoid overwhelming the system
    const CONCURRENT_ANALYSIS = 2;
    
    while (this.backgroundQueue.length > 0) {
      const batch = this.backgroundQueue.splice(0, CONCURRENT_ANALYSIS);
      
      await Promise.all(
        batch.map(symbol => this.performDeepAnalysis(symbol, scanId))
      );

      // Emit progress
      const remaining = this.backgroundQueue.length;
      this.emit('analysisProgress', {
        scanId,
        processed: batch,
        remaining,
        timestamp: new Date()
      });
    }

    console.log(`[FastScanner] Deep analysis complete for scan ${scanId}`);
    this.emit('deepAnalysisComplete', { scanId, timestamp: new Date() });
  }

  /**
   * Perform deep analysis on a single symbol
   */
  private async performDeepAnalysis(symbol: string, scanId: string) {
    try {
      console.log(`[FastScanner] Deep analysis: ${symbol}`);

      // Update signal status
      const signal = this.scanResults.get(symbol);
      if (signal) {
        signal.status = 'analyzing';
        this.scanResults.set(symbol, signal);
      }

      // Call scanner API for deep analysis
      try {
        const response = await axios.post(`${this.SCANNER_API_URL}/api/scanner/scan`, {
          timeframe: '1h',
          exchange: 'kucoinfutures',
          signal: 'all',
          minStrength: 0,
          fullAnalysis: true // Full analysis
        }, {
          timeout: 180000 // 180 second timeout (3 minutes) for deep analysis
        });

        if (response.data && response.data.signals && response.data.signals.length > 0) {
          // Find the signal for this specific symbol
          const scannerSignal = response.data.signals.find((s: any) => s.symbol === symbol) || response.data.signals[0];

          const deepData: DeepAnalysis = {
            scanId,
            symbol,
            opportunity_score: scannerSignal.opportunity_score,
            market_regime: scannerSignal.market_regime,
            sl_tp: scannerSignal.sl_tp,
            confluence: scannerSignal.confluence,
            ml_prediction: scannerSignal.ml_prediction,
            timestamp: new Date()
          };

          this.deepAnalysis.set(symbol, deepData);

          // Update signal status
          if (signal) {
            signal.status = 'complete';
            // Enhance with deep analysis
            (signal as any).opportunity_score = deepData.opportunity_score;
            (signal as any).market_regime = deepData.market_regime;
            (signal as any).sl_tp = deepData.sl_tp;
            this.scanResults.set(symbol, signal);
          }

          // Emit individual update
          this.emit('symbolAnalyzed', {
            scanId,
            symbol,
            signal,
            deepData,
            timestamp: new Date()
          });

          return;
        }
      } catch (apiError: any) {
        console.warn(`[FastScanner] API deep analysis failed for ${symbol}, using fallback:`, apiError.message);
      }

      // No fallback - if API fails, mark as incomplete
      console.error(`[FastScanner] Deep analysis unavailable for ${symbol}`);
      
      if (signal) {
        signal.status = 'quick_scan'; // Revert to quick scan status
        this.scanResults.set(symbol, signal);
      }

    } catch (error) {
      console.error(`[FastScanner] Deep analysis failed for ${symbol}:`, error);
    }
  }

  /**
   * Start periodic scanning every 15 minutes
   */
  private startPeriodicScanning() {
    console.log('[FastScanner] Starting periodic scanning (15 min intervals)');
    
    // Initial scan after 5 seconds
    setTimeout(() => {
      this.quickScan().catch(err => 
        console.error('[FastScanner] Initial scan failed:', err)
      );
    }, 5000);

    // Periodic scans every 15 minutes
    this.intervalId = setInterval(() => {
      console.log('[FastScanner] Triggering periodic scan');
      this.quickScan().catch(err => 
        console.error('[FastScanner] Periodic scan failed:', err)
      );
    }, this.SCAN_INTERVAL);
  }

  /**
   * Stop periodic scanning
   */
  stopPeriodicScanning() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[FastScanner] Stopped periodic scanning');
    }
  }

  /**
   * Get current scan results
   */
  getCurrentResults(): QuickSignal[] {
    return Array.from(this.scanResults.values());
  }

  /**
   * Get results for a specific symbol
   */
  getSymbolData(symbol: string): { signal: QuickSignal | undefined; deepData: DeepAnalysis | undefined } {
    return {
      signal: this.scanResults.get(symbol),
      deepData: this.deepAnalysis.get(symbol)
    };
  }

  /**
   * Get scan history
   */
  getScanHistory() {
    return this.scanHistory;
  }

  /**
   * Get scanning status
   */
  getStatus() {
    return {
      isScanning: this.isScanning,
      currentScanId: this.currentScanId,
      signalsCount: this.scanResults.size,
      backgroundQueueLength: this.backgroundQueue.length,
      lastScan: this.scanHistory.length > 0 ? this.scanHistory[this.scanHistory.length - 1] : null,
      periodicScanningEnabled: this.intervalId !== null
    };
  }

  /**
   * Force trigger a scan
   */
  async triggerScan(symbols?: string[]): Promise<QuickSignal[]> {
    return this.quickScan(symbols);
  }
}

// Export singleton instance
export const fastScanner = new FastScannerService();
export default fastScanner;

