

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Brain, Zap, Eye, Target, Clock, TrendingUp, AlertTriangle, Sparkles, Settings, Play, Pause, RotateCcw, Activity, Waves, Shield, Crown, Gauge, Bolt } from 'lucide-react';
import axios from 'axios';

// Define TemporalFrame interface
interface TemporalFrame {
  timestamp: number;
  price: {
    open: number;
    high: number;
    low: number;
    close: number;
  };
  volume: number;
  volatility: number;
  momentum_score: number;
  rsi: number;
  trend_score: number;
  confidence_score: number;
  composite_score: number;
  volume_score: number;
  anchor_index: number;
  price_range: number;
  predicted_return: number;
  predicted_consistent: number;
  temporal_ghost: {
    next_moves: Array<{
      timestamp: number;
      predicted_price: number;
      confidence: number;
      probability: number;
      pattern_match: number;
    }>;
    certainty_river: number;
    time_distortion: number;
    pattern_resonance: number;
    quantum_coherence: number;
    fractal_depth: number;
  };
  intention_field: {
    accumulation_pressure: number;
    breakout_membrane: number;
    momentum_vector: {
      direction: "up" | "down" | "sideways";
      strength: number;
      timing: number;
      acceleration: number;
    };
    whale_presence: number;
    institutional_flow: number;
    retail_sentiment: number;
    liquidity_depth: number;
  };
  power_level: {
    edge_percentage: number;
    opportunity_intensity: number;
    risk_shadow: number;
    profit_magnetism: number;
    certainty_coefficient: number;
    godmode_factor: number;
    quantum_advantage: number;
    reality_bend_strength: number;
  };
  market_layers: {
    fear_greed_index: number;
    volatility_regime: "low" | "medium" | "high" | "extreme";
    trend_strength: number;
    support_resistance: {
      nearest_support: number;
      nearest_resistance: number;
      strength: number;
    };
    market_phase: "accumulation" | "markup" | "distribution" | "markdown";
  };
  consciousness_matrix: {
    awareness_level: number;
    collective_intelligence: number;
    prediction_accuracy: number;
    reality_stability: number;
    temporal_variance: number;
  };
}

// Calculator functions (unchanged from original)
// Frontend config loader
let frontendConfig: any = null;

async function loadFrontendConfig() {
  if (frontendConfig) return frontendConfig;
  const res = await axios.get('/config/frontend-config.json');
  frontendConfig = res.data;
  return frontendConfig;
}
const calculateQuantumTemporalLayer = async (historicalData: TemporalFrame[], currentFrame: TemporalFrame) => {
  const config = await loadFrontendConfig();
  const nextMoves: Array<{
    timestamp: number;
    predicted_price: number;
    confidence: number;
    probability: number;
    pattern_match: number;
  }> = [];
  const basePrice = currentFrame.price.close;
  const volatility = currentFrame.volatility;
  const momentum = currentFrame.momentum_score;
  const rsi = currentFrame.rsi;
  
  const patternStrength = Math.abs(momentum - 50) / 50;
  const rsiDivergence = Math.abs(rsi - 50) / 50;
  const volumePattern = currentFrame.volume > config.analytics.volumePatternThreshold ? 0.3 : 0;
  const pattern_resonance = (patternStrength + rsiDivergence + volumePattern) / 3;
  const quantum_coherence = Math.min(1, pattern_resonance * 1.5 + (volatility < config.analytics.quantumCoherenceVolatilityLow ? 0.3 : 0));
  const fractal_depth = historicalData.length > config.analytics.fractalDepthMinLength ? Math.min(1, Math.abs(momentum - 50) / 30 + pattern_resonance * 0.5) : 0.5;
  
  for (let i = 1; i <= 7; i++) {
    const timeOffset = i * 45000;
    const momentumDecay = Math.pow(0.92, i);
    const quantumFactor = Math.sin(i * quantum_coherence * Math.PI) * volatility * 2;
    const fractalInfluence = Math.cos(i * fractal_depth * Math.PI * 0.5) * volatility;
    
    const trendStrength = (momentum - 50) / 50;
    const rsiPressure = rsi > 75 ? -0.4 : rsi < 25 ? 0.4 : (50 - Math.abs(rsi - 50)) / 125;
    const cyclicalComponent = Math.sin(Date.now() / 80000 + i * 0.7) * volatility * 0.6;
    const quantumTunnel = quantum_coherence > 0.8 ? volatility * 5 * Math.random() : 0;
    
    const predicted_price = basePrice + 
      (trendStrength * volatility * 18 * momentumDecay) +
      (rsiPressure * volatility * 12) +
      quantumFactor +
      fractalInfluence +
      cyclicalComponent +
      quantumTunnel;
    
    const timeDecay = Math.max(0.15, 1 - (i * 0.12));
    const patternBonus = pattern_resonance * 0.5;
    const quantumBonus = quantum_coherence * 0.3;
    const fractalBonus = fractal_depth * 0.2;
  const volatilityPenalty = Math.min(config.analytics.volatilityPenaltyMax, volatility / config.analytics.volatilityPenaltyDivisor);
  const confidence = Math.min(config.analytics.confidenceMax, timeDecay + patternBonus + quantumBonus + fractalBonus - volatilityPenalty);
    
    const pattern_match = Math.min(1, pattern_resonance + quantum_coherence * 0.5);
    
    nextMoves.push({
      timestamp: currentFrame.timestamp + timeOffset,
      predicted_price,
      confidence,
      probability: confidence * (trendStrength > 0.15 ? 1 : trendStrength < -0.15 ? -1 : 0),
      pattern_match
    });
  }
  
  return {
    next_moves: nextMoves,
    certainty_river: pattern_resonance * 0.7 + quantum_coherence * 0.3,
    time_distortion: Math.min(1, (volatility / 10) + (quantum_coherence * 0.4)),
    pattern_resonance,
    quantum_coherence,
    fractal_depth
  };
};

// Removed duplicate non-async calculateUltimateIntentionField
const calculateUltimateIntentionField = async (currentFrame: TemporalFrame, volume_avg: number, historicalData: TemporalFrame[]) => {
  const config = await loadFrontendConfig();
  const rsi = currentFrame.rsi;
  const volume = currentFrame.volume;
  const momentum = currentFrame.momentum_score;
  const volatility = currentFrame.volatility;
  
  const rsi_pressure = rsi < 30 ? (30 - rsi) / 30 : rsi > 70 ? (rsi - 70) / 30 : 0;
  const momentum_alignment = Math.abs(momentum - 50) / 50;
  const stealth_accumulation = volume > volume_avg * config.risk.stealthAccumulationMultiplier && volatility < config.risk.volatilityLow ? 0.4 : 0;
  const volume_surge = Math.min(3, volume / volume_avg);
  const accumulation_pressure = (volume_surge + rsi_pressure + momentum_alignment + stealth_accumulation) / 4;
  const extreme_conditions = (rsi > 80 || rsi < 20) ? 0.9 : (rsi > 70 || rsi < 30) ? 0.6 : 0;
  const momentum_extreme = momentum > config.risk.momentumExtremeHigh || momentum < config.risk.momentumExtremeLow ? 0.8 : momentum > config.risk.momentumHigh || momentum < config.risk.momentumLow ? 0.5 : 0;
  const volume_confirmation = volume > volume_avg * config.risk.volumeConfirmationMultiplier ? 0.7 : volume > volume_avg * config.risk.volumeConfirmationMidMultiplier ? 0.4 : 0;
  const volatility_spike = volatility > config.risk.volatilitySpike ? 0.5 : 0;
  const breakout_membrane = Math.min(1, extreme_conditions + momentum_extreme + volume_confirmation + volatility_spike);
  const direction = momentum > 60 ? "up" : momentum < 40 ? "down" : "sideways";
  const strength = Math.abs(momentum - 50) / 50;
  const urgency_factor = breakout_membrane * config.risk.urgencyFactorWeights.breakoutMembrane + volume_surge * config.risk.urgencyFactorWeights.volumeSurge;
  const base_timing = strength > 0.8 ? config.risk.baseTiming.strong : strength > 0.6 ? config.risk.baseTiming.medium : strength > 0.4 ? config.risk.baseTiming.weak : strength > 0.2 ? config.risk.baseTiming.veryWeak : config.risk.baseTiming.default;
  const timing = Math.max(config.risk.timingMin, base_timing - urgency_factor * 8);
  const acceleration = breakout_membrane * strength * 0.8;
  
  const unusual_volume = volume > volume_avg * 3 ? 1 : volume > volume_avg * 2 ? 0.7 : 0;
  const price_stability = volatility < 4 && volume > volume_avg * 1.5 ? 0.8 : 0;
  const dark_pool_activity = volume > volume_avg * 1.8 && momentum > 60 && momentum < 80 ? 0.6 : 0;
  const whale_presence = Math.min(1, unusual_volume + price_stability + dark_pool_activity);
  
  const smart_money_pattern = (rsi < 35 && momentum > 55) || (rsi > 65 && momentum < 45) ? 0.8 : 0;
  const volume_profile = volume > volume_avg * 1.3 ? 0.5 : 0;
  const institutional_flow = Math.min(1, smart_money_pattern + volume_profile + whale_presence * 0.3);
  
  const fomo_pattern = rsi > 75 && momentum > 80 ? 0.9 : 0;
  const panic_pattern = rsi < 25 && momentum < 20 ? 0.9 : 0;
  const retail_sentiment = Math.max(fomo_pattern, panic_pattern);
  
  const volume_consistency = volume > volume_avg * 0.8 ? 0.6 : 0.3;
  const spread_tightness = volatility < 8 ? 0.5 : 0.2;
  const liquidity_depth = Math.min(1, volume_consistency + spread_tightness + (volume_surge * 0.3));
  
  return {
    accumulation_pressure,
    breakout_membrane,
    momentum_vector: { direction, strength, timing, acceleration },
    whale_presence,
    institutional_flow,
    retail_sentiment,
    liquidity_depth
  };
};

const calculateGodmodePowerLevel = (currentFrame: TemporalFrame, intentionField: any, temporalGhost: any) => {
  const momentum = currentFrame.momentum_score;
  const rsi = currentFrame.rsi;
  const volatility = currentFrame.volatility;
  
  const momentum_edge = Math.abs(momentum - 50) / 50 * 0.4;
  const rsi_edge = (rsi > 80 || rsi < 20) ? 0.35 : (rsi > 70 || rsi < 30) ? 0.25 : (rsi > 60 || rsi < 40) ? 0.15 : 0;
  const volatility_edge = Math.min(0.25, volatility / 12);
  const pattern_edge = temporalGhost.pattern_resonance * 0.25;
  const quantum_edge = temporalGhost.quantum_coherence * 0.2;
  const fractal_edge = temporalGhost.fractal_depth * 0.15;
  const edge_percentage = (momentum_edge + rsi_edge + volatility_edge + pattern_edge + quantum_edge + fractal_edge) * 100;
  
  const setup_quality = intentionField.breakout_membrane * intentionField.momentum_vector.strength;
  const temporal_alignment = temporalGhost.certainty_river * 0.5;
  const whale_boost = intentionField.whale_presence * 0.4;
  const institutional_boost = intentionField.institutional_flow * 0.3;
  const liquidity_boost = intentionField.liquidity_depth * 0.2;
  const opportunity_intensity = Math.min(1, setup_quality + temporal_alignment + whale_boost + institutional_boost + liquidity_boost);
  
  const overextended_risk = (rsi > 90 || rsi < 10) ? 1 : (rsi > 80 || rsi < 20) ? 0.7 : (rsi > 75 || rsi < 25) ? 0.4 : 0;
  const low_momentum_risk = momentum < 20 ? 0.8 : momentum < 30 ? 0.5 : 0;
  const high_volatility_risk = volatility > 20 ? 0.8 : volatility > 15 ? 0.5 : volatility > 10 ? 0.3 : 0;
  const time_distortion_risk = temporalGhost.time_distortion > 0.9 ? 0.5 : temporalGhost.time_distortion > 0.7 ? 0.3 : 0;
  const retail_sentiment_risk = intentionField.retail_sentiment > 0.8 ? 0.4 : 0;
  const liquidity_risk = intentionField.liquidity_depth < 0.3 ? 0.5 : 0;
  const risk_shadow = Math.min(1, Math.max(overextended_risk, low_momentum_risk, high_volatility_risk) + time_distortion_risk + retail_sentiment_risk + liquidity_risk);
  
  const profit_magnetism = opportunity_intensity * (1 - risk_shadow * 0.6);
  const certainty_coefficient = (temporalGhost.certainty_river + (edge_percentage / 100) + temporalGhost.quantum_coherence) / 3;
  
  const godmode_factor = Math.min(1, (edge_percentage / 100) * opportunity_intensity * certainty_coefficient * (1 - risk_shadow * 0.5));
  const quantum_advantage = temporalGhost.quantum_coherence * temporalGhost.fractal_depth * (edge_percentage / 100);
  const reality_bend_strength = godmode_factor > 0.8 ? Math.min(1, godmode_factor * 1.2) : godmode_factor;
  
  return {
    edge_percentage,
    opportunity_intensity,
    risk_shadow,
    profit_magnetism,
    certainty_coefficient,
    godmode_factor,
    quantum_advantage,
    reality_bend_strength
  };
};

const calculateMarketLayers = (currentFrame: TemporalFrame, historicalData: TemporalFrame[]) => {
  const rsi = currentFrame.rsi;
  const momentum = currentFrame.momentum_score;
  const volatility = currentFrame.volatility;
  const volume = currentFrame.volume;
  
  const fear_greed_index = ((momentum + (100 - rsi)) / 2) / 100;
  const volatility_regime = volatility > 15 ? "extreme" : volatility > 10 ? "high" : volatility > 5 ? "medium" : "low";
  const trend_strength = Math.abs(momentum - 50) / 50;
  const price = currentFrame.price.close;
  const nearest_support = price * (0.98 - volatility / 1000);
  const nearest_resistance = price * (1.02 + volatility / 1000);
  const sr_strength = trend_strength * 0.7 + (volatility < 8 ? 0.3 : 0);
  
  let market_phase = "sideways";
  if (rsi < 40 && momentum < 40 && volume > 800) market_phase = "accumulation";
  else if (momentum > 60 && trend_strength > 0.6) market_phase = "markup";
  else if (rsi > 70 && momentum > 70 && volume > 1200) market_phase = "distribution";
  else if (momentum < 40 && trend_strength > 0.5) market_phase = "markdown";
  
  return {
    fear_greed_index,
    volatility_regime,
    trend_strength,
    support_resistance: { nearest_support, nearest_resistance, strength: sr_strength },
    market_phase
  };
};

const calculateConsciousnessMatrix = (currentFrame: TemporalFrame, temporalGhost: any, powerLevel: any, historicalData: TemporalFrame[]) => {
  const pattern_recognition_strength = temporalGhost.pattern_resonance;
  const quantum_coherence_level = temporalGhost.quantum_coherence;
  const awareness_level = (pattern_recognition_strength + quantum_coherence_level) / 2;
  const short_term_alignment = Math.abs(currentFrame.momentum_score - 50) / 50;
  const medium_term_alignment = temporalGhost.certainty_river;
  const collective_intelligence = (short_term_alignment + medium_term_alignment) / 2;
  const avg_confidence = temporalGhost.next_moves.reduce((sum: number, move: any) => sum + move.confidence, 0) / temporalGhost.next_moves.length;
  const pattern_match_strength = temporalGhost.next_moves.reduce((sum: number, move: any) => sum + move.pattern_match, 0) / temporalGhost.next_moves.length;
  const prediction_accuracy = (avg_confidence + pattern_match_strength) / 2;
  const volatility_factor = Math.max(0, 1 - currentFrame.volatility / 20);
  const temporal_stability = Math.max(0, 1 - temporalGhost.time_distortion);
  const reality_stability = (volatility_factor + temporal_stability) / 2;
  const time_distortion = temporalGhost.time_distortion;
  const quantum_uncertainty = 1 - temporalGhost.quantum_coherence;
  const temporal_variance = (time_distortion + quantum_uncertainty) / 2;
  
  return {
    awareness_level,
    collective_intelligence,
    prediction_accuracy,
    reality_stability,
    temporal_variance
  };
};

// UltimateTemporalCandle component (unchanged, included for completeness)
const UltimateTemporalCandle: React.FC<{
  frame: TemporalFrame;
  position: number;
  maxVolume: number;
  index: number;
  isLatest: boolean;
}> = ({ frame, position, maxVolume, index, isLatest }) => {
  const [isGlowing, setIsGlowing] = useState(false);
  const [showGhosts, setShowGhosts] = useState(false);
  const [pulseIntensity, setPulseIntensity] = useState(0);
  const [godmodeActive, setGodmodeActive] = useState(false);
  const [quantumField, setQuantumField] = useState(false);
  
  const normalizedVolume = (frame.volume / maxVolume) * 100;
  const edgeIntensity = frame.power_level.edge_percentage;
  const opportunityGlow = frame.power_level.opportunity_intensity;
  const riskShadow = frame.power_level.risk_shadow;
  const godmodeFactor = frame.power_level.godmode_factor;
  const quantumAdvantage = frame.power_level.quantum_advantage;
  const realityBend = frame.power_level.reality_bend_strength;
  
  const getCandleColor = () => {
    const uiCutoffs = frontendConfig?.uiCutoffs || {
      godmodeFactor: 0.9,
      realityBend: 0.8,
      quantumAdvantage: 0.7,
      profitMagnetism: 0.8,
      certaintyCoefficient: 0.8,
      riskShadow: 0.7,
      whalePresence: 0.7,
      institutionalFlow: 0.7,
      breakoutMembrane: 0.8,
      momentumStrong: 75,
      momentumMedium: 50,
      momentumWeak: 25
    };
    if (godmodeFactor > uiCutoffs.godmodeFactor) return '#ff00ff';
    if (realityBend > uiCutoffs.realityBend) return '#00ffff';
    if (quantumAdvantage > uiCutoffs.quantumAdvantage) return '#ffff00';
    if (frame.power_level.profit_magnetism > uiCutoffs.profitMagnetism) return '#00ff00';
    if (frame.power_level.certainty_coefficient > uiCutoffs.certaintyCoefficient) return '#00ffaa';
    if (frame.power_level.risk_shadow > uiCutoffs.riskShadow) return '#ff3333';
    if (frame.intention_field.whale_presence > uiCutoffs.whalePresence) return '#8a2be2';
    if (frame.intention_field.institutional_flow > uiCutoffs.institutionalFlow) return '#ffd700';
    if (frame.intention_field.breakout_membrane > uiCutoffs.breakoutMembrane) return '#ffaa00';
    const momentum = frame.momentum_score;
    return momentum > uiCutoffs.momentumStrong ? '#4fc3f7' : momentum > uiCutoffs.momentumMedium ? '#66bb6a' : momentum > uiCutoffs.momentumWeak ? '#ffa726' : '#ff6b6b';
  };
  
  const renderUltimateGhostTrail = () => {
    if (!frame.temporal_ghost.next_moves.length) return null;
    
    return frame.temporal_ghost.next_moves.map((ghost, i) => {
      const opacity = ghost.confidence * 0.9 * (1 - i * 0.1);
      const height = Math.max(8, ghost.confidence * 50);
      const patternStrength = ghost.pattern_match;
      
      let color = '#888888';
      if (ghost.probability > 0.5) color = '#00ff88';
      else if (ghost.probability < -0.5) color = '#ff4444';
      else if (patternStrength > 0.8) color = '#ffaa00';
      else if (ghost.confidence > 0.9) color = '#00aaff';
      
      return (
        <div
          key={i}
          className="absolute rounded-full transition-all duration-1000"
          style={{
            width: `${2 + patternStrength * 2}px`,
            height: `${height}px`,
            backgroundColor: color,
            opacity,
            left: `${15 + i * 10}px`,
            top: `-${30 + i * 15}px`,
            boxShadow: `0 0 ${ghost.confidence * 20}px ${color}`,
            animation: `ghostFloat ${1.5 + i * 0.3}s ease-in-out infinite alternate, quantumShimmer ${3 + i}s infinite`
          }}
        />
      );
    });
  };
  
  const renderUltimateIntentionField = () => {
    const field = frame.intention_field;
    
    return (
      <>
        {frame.temporal_ghost.quantum_coherence > 0.7 && (
          <div 
            className="absolute -top-5 -left-2 w-8 h-2 rounded-full"
            style={{
              backgroundColor: '#ff00ff',
              opacity: frame.temporal_ghost.quantum_coherence,
              boxShadow: `0 0 ${frame.temporal_ghost.quantum_coherence * 15}px #ff00ff`,
              animation: 'quantumPulse 1s infinite'
            }}
          />
        )}
        {field.institutional_flow > 0.6 && (
          <div 
            className="absolute -top-3 -right-1 w-5 h-1 rounded-full"
            style={{
              backgroundColor: '#ffd700',
              opacity: field.institutional_flow,
              boxShadow: `0 0 ${field.institutional_flow * 12}px #ffd700`
            }}
          />
        )}
        {field.whale_presence > 0.5 && (
          <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
            <Crown 
              className="w-4 h-4 text-purple-400 animate-bounce" 
              style={{ opacity: field.whale_presence }}
            />
          </div>
        )}
        {field.accumulation_pressure > 0.4 && (
          <div className="absolute -bottom-4 left-0 right-0 flex justify-center">
            <div 
              className="w-16 h-3 rounded-full"
              style={{
                background: `linear-gradient(90deg, #8b5cf6, #a855f7, #8b5cf6)`,
                opacity: field.accumulation_pressure * 0.9,
                boxShadow: `0 0 ${field.accumulation_pressure * 20}px #8b5cf6`,
                animation: `accumulate ${2.5 / field.accumulation_pressure}s ease-in-out infinite`
              }}
            />
          </div>
        )}
        {realityBend > 0.7 && (
          <div 
            className="absolute -inset-2 border-3 rounded-xl"
            style={{
              borderImage: `linear-gradient(45deg, #ff00ff, #00ffff, #ffff00, #ff00ff) 1`,
              borderStyle: 'solid',
              borderWidth: '2px',
              opacity: realityBend,
              animation: `realityBend ${1 / realityBend}s linear infinite`
            }}
          />
        )}
        {godmodeFactor > 0.8 && (
          <div 
            className="absolute -inset-4 rounded-2xl"
            style={{
              background: `radial-gradient(circle, #ff00ff44, #00ffff22, transparent)`,
              opacity: godmodeFactor,
              animation: 'godmodeAura 2s ease-in-out infinite'
            }}
          />
        )}
        {field.momentum_vector.strength > 0.5 && (
          <div 
            className="absolute -right-10 top-1/2 transform -translate-y-1/2 flex flex-col items-center"
            style={{ opacity: field.momentum_vector.strength }}
          >
            {field.momentum_vector.direction === 'up' && (
              <div className="flex flex-col items-center space-y-1">
                <TrendingUp className="w-6 h-6 text-green-400 animate-bounce" />
                <Bolt className="w-3 h-3 text-yellow-400" style={{ opacity: field.momentum_vector.acceleration }} />
                {field.momentum_vector.timing <= 3 && (
                  <span className="text-xs text-green-400 font-bold bg-black/70 px-1 rounded">
                    {field.momentum_vector.timing.toFixed(1)}m
                  </span>
                )}
              </div>
            )}
            {field.momentum_vector.direction === 'down' && (
              <div className="flex flex-col items-center space-y-1">
                <TrendingUp className="w-6 h-6 text-red-400 animate-bounce rotate-180" />
                <Bolt className="w-3 h-3 text-orange-400" style={{ opacity: field.momentum_vector.acceleration }} />
                {field.momentum_vector.timing <= 3 && (
                  <span className="text-xs text-red-400 font-bold bg-black/70 px-1 rounded">
                    {field.momentum_vector.timing.toFixed(1)}m
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </>
    );
  };
  
  useEffect(() => {
    const shouldGlow = frame.power_level.opportunity_intensity > 0.7 || frame.power_level.edge_percentage > 25;
    const shouldShowGhosts = frame.temporal_ghost.certainty_river > 0.6;
    const pulse = frame.power_level.profit_magnetism;
    const godmode = frame.power_level.godmode_factor > 0.8;
    const quantum = frame.temporal_ghost.quantum_coherence > 0.7;
    
    setIsGlowing(shouldGlow);
    setShowGhosts(shouldShowGhosts);
    setPulseIntensity(pulse);
    setGodmodeActive(godmode);
    setQuantumField(quantum);
  }, [frame]);
  
  return (
    <div 
      className="relative flex flex-col items-center transition-all duration-700"
      style={{ 
        transform: `scale(${1 + opportunityGlow * 0.4 + (isLatest ? 0.15 : 0) + (godmodeFactor * 0.2)})`,
        filter: riskShadow > 0.6 ? `brightness(${1 - riskShadow * 0.3}) contrast(1.3) saturate(1.2)` : `saturate(${1 + opportunityGlow})`,
        zIndex: isLatest ? 20 : godmodeFactor > 0.8 ? 15 : index + 1
      }}
    >
      {showGhosts && (
        <div className="absolute -top-20 -left-6 w-20 h-20">
          {renderUltimateGhostTrail()}
        </div>
      )}
      <div 
        className="absolute -inset-3 rounded-2xl transition-all duration-1000"
        style={{
          background: `
            radial-gradient(ellipse at center, ${getCandleColor()}44 0%, ${getCandleColor()}22 30%, transparent 70%),
            conic-gradient(from ${Date.now() / 50}deg, ${getCandleColor()}11, transparent, ${getCandleColor()}11)
          `,
          transform: `scale(${1 + pulseIntensity * 0.3})`,
          opacity: isGlowing ? 0.9 : 0.3,
          animation: isGlowing ? `ultimateGlow 2s ease-in-out infinite` : 'none'
        }}
      />
      <div 
        className="relative w-16 rounded-lg cursor-pointer transition-all duration-300 shadow-2xl"
        style={{
          height: `${Math.max(32, normalizedVolume * 2)}px`,
          background: `linear-gradient(135deg, ${getCandleColor()}, ${getCandleColor()}aa)`,
          boxShadow: `
            0 0 ${godmodeFactor * 40}px ${getCandleColor()},
            0 0 ${opportunityGlow * 30}px ${getCandleColor()}55,
            inset 0 0 ${edgeIntensity / 2}px #ffffff33
          `,
          border: godmodeActive ? '2px solid #ff00ff' : quantumField ? '1px solid #00ffff' : 'none',
          animation: godmodeActive ? `godmodePulse 0.8s ease-in-out infinite` : quantumField ? `quantumPhase 1.5s linear infinite` : 'none'
        }}
        onMouseEnter={() => setIsGlowing(true)}
        onMouseLeave={() => setIsGlowing(false)}
      >
        {edgeIntensity > 15 && (
          <div 
            className="absolute -top-8 left-1/2 transform -translate-x-1/2 px-2 py-1 rounded-full text-xs font-bold bg-black/80 text-white"
            style={{ 
              border: `1px solid ${getCandleColor()}`,
              boxShadow: `0 0 10px ${getCandleColor()}`
            }}
          >
            {edgeIntensity.toFixed(1)}% EDGE
          </div>
        )}
        {godmodeActive && (
          <div className="absolute -top-5 left-1/2 transform -translate-x-1/2">
            <Crown className="w-6 h-6 text-[#ff00ff] animate-pulse" />
          </div>
        )}
        {quantumField && (
          <div 
            className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 w-8 h-2 rounded-full"
            style={{
              background: `linear-gradient(90deg, #00ffff, #ff00ff, #00ffff)`,
              backgroundSize: '200% 100%',
              animation: 'quantumFlow 2s linear infinite',
              boxShadow: `0 0 15px #00ffff`
            }}
          />
        )}
        {renderUltimateIntentionField()}
        {frame.predicted_consistent === 1 && (
          <div className="absolute -top-10 left-1/2 transform -translate-x-1/2">
            <Shield className="w-4 h-4 text-green-400 animate-pulse" />
          </div>
        )}
        {frame.predicted_return > 5 && (
          <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 px-2 py-1 rounded-full text-xs font-bold bg-black/80 text-green-400">
            {frame.predicted_return.toFixed(1)}% Predicted
          </div>
        )}
      </div>
      <div className="relative mt-2 w-16 h-8">
        <div 
          className="absolute bottom-0 w-full rounded-t transition-all duration-700"
          style={{
            height: `${Math.min(100, normalizedVolume)}%`,
            background: `linear-gradient(to top, ${getCandleColor()}88, ${getCandleColor()}44)`,
            boxShadow: `0 0 ${normalizedVolume / 2}px ${getCandleColor()}`
          }}
        />
        {normalizedVolume > 70 && (
          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
            <Zap className="w-4 h-4 text-yellow-400 animate-pulse" />
          </div>
        )}
      </div>
      <div className="absolute -bottom-12 text-xs text-gray-400 font-mono">
        {new Date(frame.timestamp).toLocaleTimeString('en-US', { 
          hour12: false, 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        })}
      </div>
    </div>
  );
};

// Main UltimateMVIPInterface component
const UltimateMVIPInterface: React.FC = () => {
  const [frames, setFrames] = useState<TemporalFrame[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(1000);
  const [volumeAvg, setVolumeAvg] = useState(1000);
  const [showGhostTrails, setShowGhostTrails] = useState(true);
  const [showIntentionField, setShowIntentionField] = useState(true);
  const [showPowerLevels, setShowPowerLevels] = useState(true);
  const [quantumMode, setQuantumMode] = useState(false);
  const [timeframe, setTimeframe] = useState('1d');
  
  const intervalRef = useRef<number | null>(null);

  // Fetch frames from API
  const fetchFrames = useCallback(async () => {
    try {
      const response = await axios.get(`http://localhost:8000/frames/${timeframe}`);
      const rawFrames: any[] = response.data;
      const processedFrames = rawFrames.map((frame, idx) => {
        const historicalData = rawFrames.slice(0, idx);
        const temporal_ghost = calculateQuantumTemporalLayer(historicalData, frame);
        const intention_field = calculateUltimateIntentionField(frame, volumeAvg, historicalData);
        const power_level = calculateGodmodePowerLevel(frame, intention_field, temporal_ghost);
        const market_layers = calculateMarketLayers(frame, historicalData);
        const consciousness_matrix = calculateConsciousnessMatrix(frame, temporal_ghost, power_level, historicalData);
        return { ...frame, temporal_ghost, intention_field, power_level, market_layers, consciousness_matrix };
      });
      setFrames(processedFrames);
      setVolumeAvg(rawFrames.reduce((sum, f) => sum + f.volume, 0) / rawFrames.length || 1000);
    } catch (error) {
      console.error('Error fetching frames:', error);
    }
  }, [timeframe, volumeAvg]);

  // Periodic fetching
  useEffect(() => {
    fetchFrames();
    if (isRunning) {
      intervalRef.current = window.setInterval(fetchFrames, speed);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, speed, fetchFrames]);

  const maxVolume = useMemo(() => Math.max(...frames.map(f => f.volume), 1), [frames]);
  const latestFrame = frames[frames.length - 1];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-black text-white p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <Brain className="w-12 h-12 text-purple-400" />
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Ultimate M-VIP Interface
            </h1>
            <p className="text-gray-400">Temporal Consciousness Trading Engine v∞</p>
          </div>
        </div>
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-4 bg-gray-800/50 rounded-lg p-4">
            <button
              onClick={() => setIsRunning(!isRunning)}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
            >
              {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isRunning ? 'Pause' : 'Start'}</span>
            </button>
            <button
              onClick={fetchFrames}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <div className="flex items-center space-x-2">
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="bg-gray-700 text-white rounded-lg p-2"
              >
                <option value="1m">1m</option>
                <option value="5m">5m</option>
                <option value="1h">1h</option>
                <option value="1d">1d</option>
                <option value="1w">1w</option>
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <Gauge className="w-4 h-4 text-purple-400" />
              <input
                type="range"
                min="100"
                max="3000"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="w-24"
              />
              <span className="text-sm text-gray-400">{speed}ms</span>
            </div>
          </div>
          <div className="flex space-x-4">
            <div className="flex items-center space-x-2">
              <Sparkles className={`w-5 h-5 ${quantumMode ? 'text-purple-400 animate-pulse' : 'text-gray-500'}`} />
              <label className="text-sm">
                <input
                  type="checkbox"
                  checked={quantumMode}
                  onChange={(e) => setQuantumMode(e.target.checked)}
                  className="mr-1"
                />
                Quantum Mode
              </label>
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8">
          <div className="bg-gray-900/50 rounded-xl p-6 border border-purple-500/20">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center space-x-2">
                <Activity className="w-5 h-5 text-purple-400" />
                <span>Temporal Consciousness Chart</span>
              </h2>
              <div className="flex space-x-2">
                <label className="flex items-center space-x-1 text-sm">
                  <input type="checkbox" checked={showGhostTrails} onChange={e => setShowGhostTrails(e.target.checked)} />
                  <Eye className="w-3 h-3" />
                  <span>Ghosts</span>
                </label>
                <label className="flex items-center space-x-1 text-sm">
                  <input type="checkbox" checked={showIntentionField} onChange={e => setShowIntentionField(e.target.checked)} />
                  <Target className="w-3 h-3" />
                  <span>Intention</span>
                </label>
                <label className="flex items-center space-x-1 text-sm">
                  <input type="checkbox" checked={showPowerLevels} onChange={e => setShowPowerLevels(e.target.checked)} />
                  <Zap className="w-3 h-3" />
                  <span>Power</span>
                </label>
              </div>
            </div>
            <div className="flex space-x-2 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-purple-600 scrollbar-track-gray-800">
              {frames.map((frame, index) => (
                <div key={frame.timestamp}>
                  <UltimateTemporalCandle
                    frame={frame}
                    position={index}
                    maxVolume={maxVolume}
                    index={index}
                    isLatest={index === frames.length - 1}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="col-span-4 space-y-6">
          {latestFrame && (
            <>
              <div className="bg-gray-900/50 rounded-xl p-4 border border-purple-500/20">
                <h3 className="text-lg font-semibold mb-3 flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-yellow-400" />
                  <span>Power Levels</span>
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Edge %</span>
                    <span className="font-mono text-yellow-400">{latestFrame.power_level.edge_percentage.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Opportunity</span>
                    <span className={`font-mono ${latestFrame.power_level.opportunity_intensity > 0.7 ? 'text-green-400' : 'text-gray-400'}`}>
                      {(latestFrame.power_level.opportunity_intensity * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Risk Shadow</span>
                    <span className={`font-mono ${latestFrame.power_level.risk_shadow > 0.6 ? 'text-red-400' : 'text-gray-400'}`}>
                      {(latestFrame.power_level.risk_shadow * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Godmode</span>
                    <span className={`font-mono ${latestFrame.power_level.godmode_factor > 0.8 ? 'text-purple-400 animate-pulse' : 'text-gray-400'}`}>
                      {(latestFrame.power_level.godmode_factor * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
              <div className="bg-gray-900/50 rounded-xl p-4 border border-purple-500/20">
                <h3 className="text-lg font-semibold mb-3 flex items-center space-x-2">
                  <Waves className="w-5 h-5 text-blue-400" />
                  <span>Market Layers</span>
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Volatility Regime</span>
                    <span className={`font-mono capitalize ${
                      latestFrame.market_layers.volatility_regime === 'extreme' ? 'text-red-400' :
                      latestFrame.market_layers.volatility_regime === 'high' ? 'text-orange-400' :
                      latestFrame.market_layers.volatility_regime === 'medium' ? 'text-yellow-400' : 'text-green-400'
                    }`}>
                      {latestFrame.market_layers.volatility_regime}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Market Phase</span>
                    <span className="font-mono capitalize text-blue-400">{latestFrame.market_layers.market_phase}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Trend Strength</span>
                    <span className="font-mono text-cyan-400">{(latestFrame.market_layers.trend_strength * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
              <div className="bg-gray-900/50 rounded-xl p-4 border border-purple-500/20">
                <h3 className="text-lg font-semibold mb-3 flex items-center space-x-2">
                  <Shield className="w-5 h-5 text-purple-400" />
                  <span>Consciousness Matrix</span>
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Awareness</span>
                    <span className="font-mono text-purple-400">{(latestFrame.consciousness_matrix.awareness_level * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Prediction Accuracy</span>
                    <span className="font-mono text-green-400">{(latestFrame.consciousness_matrix.prediction_accuracy * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Reality Stability</span>
                    <span className={`font-mono ${latestFrame.consciousness_matrix.reality_stability < 0.5 ? 'text-red-400' : 'text-green-400'}`}>
                      {(latestFrame.consciousness_matrix.reality_stability * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
              <div className="bg-gray-900/50 rounded-xl p-4 border border-purple-500/20">
                <h3 className="text-lg font-semibold mb-3 flex items-center space-x-2">
                  <Target className="w-5 h-5 text-green-400" />
                  <span>Intention Field</span>
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Whale Presence</span>
                    <span className={`font-mono ${latestFrame.intention_field.whale_presence > 0.6 ? 'text-purple-400' : 'text-gray-400'}`}>
                      {(latestFrame.intention_field.whale_presence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Breakout Membrane</span>
                    <span className={`font-mono ${latestFrame.intention_field.breakout_membrane > 0.7 ? 'text-orange-400' : 'text-gray-400'}`}>
                      {(latestFrame.intention_field.breakout_membrane * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Momentum Vector</span>
                    <span className={`font-mono capitalize ${latestFrame.intention_field.momentum_vector.direction === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                      {latestFrame.intention_field.momentum_vector.direction}
                    </span>
                  </div>
                </div>
              </div>
              <div className="bg-gray-900/50 rounded-xl p-4 border border-purple-500/20">
                <h3 className="text-lg font-semibold mb-3 flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  <span>ML Predictions</span>
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Predicted Return</span>
                    <span className={`font-mono ${latestFrame.predicted_return > 5 ? 'text-green-400' : 'text-gray-400'}`}>
                      {latestFrame.predicted_return.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Signal Consistency</span>
                    <span className={`font-mono ${latestFrame.predicted_consistent === 1 ? 'text-green-400' : 'text-red-400'}`}>
                      {latestFrame.predicted_consistent === 1 ? 'Consistent' : 'Inconsistent'}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`
        @keyframes ultimateGlow {
          0%, 100% { 
            box-shadow: 0 0 20px currentColor, 0 0 40px currentColor, 0 0 60px currentColor;
            transform: scale(1);
          }
          50% { 
            box-shadow: 0 0 30px currentColor, 0 0 60px currentColor, 0 0 90px currentColor;
            transform: scale(1.05);
          }
        }
        @keyframes godmodePulse {
          0%, 100% { 
            box-shadow: 0 0 40px #ff00ff, 0 0 80px #ff00ff, 0 0 120px #ff00ff;
          }
          50% { 
            box-shadow: 0 0 60px #ff00ff, 0 0 120px #ff00ff, 0 0 180px #ff00ff;
          }
        }
        @keyframes quantumPhase {
          0% { filter: hue-rotate(0deg); }
          100% { filter: hue-rotate(360deg); }
        }
        @keyframes quantumFlow {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @keyframes ghostFloat {
          0% { transform: translateY(0px) rotate(0deg); }
          100% { transform: translateY(-10px) rotate(5deg); }
        }
        @keyframes quantumShimmer {
          0% { opacity: 0.7; }
          50% { opacity: 1; }
          100% { opacity: 0.7; }
        }
        @keyframes accumulate {
          0%, 100% { transform: scaleX(1); opacity: 0.8; }
          50% { transform: scaleX(1.2); opacity: 1; }
        }
        @keyframes realityBend {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes godmodeAura {
          0%, 100% { 
            opacity: 0.8;
            transform: scale(1) rotate(0deg);
          }
          50% { 
            opacity: 1;
            transform: scale(1.1) rotate(180deg);
          }
        }
        .scrollbar-thin {
          scrollbar-width: thin;
          scrollbar-color: #8b5cf6 #1f2937;
        }
      `}</style>
    </div>
  );
}

export default UltimateMVIPInterface;