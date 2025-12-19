/**
 * User Settings Service Layer
 * Business logic and validation for user settings operations
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export interface PreferencesData {
  theme?: 'light' | 'dark';
  defaultTimeframe?: string;
  defaultExchange?: string;
  notificationsEnabled?: boolean;
  emailAlerts?: boolean;
  priceAlerts?: boolean;
  signalAlerts?: boolean;
  soundEnabled?: boolean;
}

export interface TradingSettingsData {
  positionSize?: number;
  defaultStopLoss?: number;
  defaultTakeProfit?: number;
  orderType?: string;
  slippageTolerance?: number;
  commissionRate?: number;
  riskRewardRatio?: number;
  maxDailyLoss?: number;
  maxPositionsOpen?: number;
}

export interface DashboardSettingsData {
  widgets?: string[];
  layoutName?: string;
  defaultIndicators?: string[];
  refreshInterval?: number;
}

export interface AdvancedSettingsData {
  apiRateLimit?: number;
  webhookUrl?: string;
  botScheduleEnabled?: boolean;
  botScheduleStart?: string;
  botScheduleEnd?: string;
  alertThrottling?: number;
}

export interface SecuritySettingsData {
  twoFactorEnabled?: boolean;
  ipWhitelistEnabled?: boolean;
  ipAddresses?: string[];
}

/**
 * Preferences Service
 */
export class PreferencesService {
  static validateTheme(theme: string): boolean {
    return ['light', 'dark'].includes(theme);
  }

  static validateTimeframe(timeframe: string): boolean {
    const validTimeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];
    return validTimeframes.includes(timeframe);
  }

  static sanitizePreferences(data: PreferencesData): PreferencesData {
    return {
      theme: data.theme && this.validateTheme(data.theme) ? data.theme : 'dark',
      defaultTimeframe: data.defaultTimeframe && this.validateTimeframe(data.defaultTimeframe) ? data.defaultTimeframe : '1h',
      defaultExchange: data.defaultExchange || 'binance',
      notificationsEnabled: typeof data.notificationsEnabled === 'boolean' ? data.notificationsEnabled : true,
      emailAlerts: typeof data.emailAlerts === 'boolean' ? data.emailAlerts : false,
      priceAlerts: typeof data.priceAlerts === 'boolean' ? data.priceAlerts : true,
      signalAlerts: typeof data.signalAlerts === 'boolean' ? data.signalAlerts : true,
      soundEnabled: typeof data.soundEnabled === 'boolean' ? data.soundEnabled : true,
    };
  }
}

/**
 * Trading Settings Service
 */
export class TradingSettingsService {
  static validatePositionSize(size: number): boolean {
    return size > 0 && size <= 100;
  }

  static validateStopLoss(sl: number): boolean {
    return sl > 0 && sl <= 50;
  }

  static validateTakeProfit(tp: number): boolean {
    return tp > 0 && tp <= 500;
  }

  static validateRiskRewardRatio(ratio: number): boolean {
    return ratio >= 0.5 && ratio <= 10;
  }

  static validateCommissionRate(rate: number): boolean {
    return rate >= 0 && rate <= 1;
  }

  static validateMaxDailyLoss(loss: number): boolean {
    return loss > 0 && loss <= 100;
  }

  static validateMaxPositions(positions: number): boolean {
    return positions > 0 && positions <= 100;
  }

  static sanitizeTradingSettings(data: TradingSettingsData): TradingSettingsData {
    return {
      positionSize: this.validatePositionSize(data.positionSize ?? 5) ? data.positionSize : 5,
      defaultStopLoss: this.validateStopLoss(data.defaultStopLoss ?? 2) ? data.defaultStopLoss : 2,
      defaultTakeProfit: this.validateTakeProfit(data.defaultTakeProfit ?? 5) ? data.defaultTakeProfit : 5,
      orderType: data.orderType || 'MARKET',
      slippageTolerance: data.slippageTolerance ?? 0.5,
      commissionRate: this.validateCommissionRate(data.commissionRate ?? 0.1) ? data.commissionRate : 0.1,
      riskRewardRatio: this.validateRiskRewardRatio(data.riskRewardRatio ?? 2) ? data.riskRewardRatio : 2,
      maxDailyLoss: this.validateMaxDailyLoss(data.maxDailyLoss ?? 10) ? data.maxDailyLoss : 10,
      maxPositionsOpen: this.validateMaxPositions(data.maxPositionsOpen ?? 5) ? data.maxPositionsOpen : 5,
    };
  }
}

/**
 * Dashboard Settings Service
 */
export class DashboardSettingsService {
  static validWidgets = [
    'price-chart',
    'portfolio',
    'signals',
    'performance',
    'risk-meter',
    'trade-log',
    'market-scanner',
    'alerts',
  ];

  static validateWidgets(widgets: string[]): boolean {
    return Array.isArray(widgets) && widgets.every(w => this.validWidgets.includes(w));
  }

  static validateRefreshInterval(interval: number): boolean {
    return interval >= 1 && interval <= 60;
  }

  static sanitizeDashboardSettings(data: DashboardSettingsData): DashboardSettingsData {
    return {
      widgets: this.validateWidgets(data.widgets ?? []) ? data.widgets : ['price-chart', 'portfolio', 'signals'],
      layoutName: data.layoutName || 'default',
      defaultIndicators: Array.isArray(data.defaultIndicators) ? data.defaultIndicators : ['RSI', 'MACD', 'Bollinger'],
      refreshInterval: this.validateRefreshInterval(data.refreshInterval ?? 5) ? data.refreshInterval : 5,
    };
  }
}

/**
 * Advanced Settings Service
 */
export class AdvancedSettingsService {
  static validateApiRateLimit(limit: number): boolean {
    return limit >= 100 && limit <= 10000;
  }

  static validateWebhookUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return !url || false; // Allow empty strings
    }
  }

  static validateTimeFormat(time: string): boolean {
    const regex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return regex.test(time);
  }

  static validateAlertThrottling(throttle: number): boolean {
    return throttle >= 1 && throttle <= 60;
  }

  static sanitizeAdvancedSettings(data: AdvancedSettingsData): AdvancedSettingsData {
    return {
      apiRateLimit: this.validateApiRateLimit(data.apiRateLimit ?? 1000) ? data.apiRateLimit : 1000,
      webhookUrl: this.validateWebhookUrl(data.webhookUrl ?? '') ? (data.webhookUrl || '') : '',
      botScheduleEnabled: typeof data.botScheduleEnabled === 'boolean' ? data.botScheduleEnabled : false,
      botScheduleStart: this.validateTimeFormat(data.botScheduleStart ?? '09:00') ? (data.botScheduleStart || '09:00') : '09:00',
      botScheduleEnd: this.validateTimeFormat(data.botScheduleEnd ?? '17:00') ? (data.botScheduleEnd || '17:00') : '17:00',
      alertThrottling: this.validateAlertThrottling(data.alertThrottling ?? 5) ? data.alertThrottling : 5,
    };
  }

  static isBotScheduleValid(settings: AdvancedSettingsData): boolean {
    if (!settings.botScheduleEnabled) return true;

    const [startHour, startMin] = (settings.botScheduleStart || '09:00').split(':').map(Number);
    const [endHour, endMin] = (settings.botScheduleEnd || '17:00').split(':').map(Number);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    return startTime < endTime;
  }
}

/**
 * Security Settings Service
 */
export class SecuritySettingsService {
  static validateIpAddress(ip: string): boolean {
    // IPv4
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    // IPv6 (simplified)
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|::1)$/;

    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  static sanitizeSecuritySettings(data: SecuritySettingsData): SecuritySettingsData {
    const validIps = (data.ipAddresses || []).filter(ip => this.validateIpAddress(ip));

    return {
      twoFactorEnabled: typeof data.twoFactorEnabled === 'boolean' ? data.twoFactorEnabled : false,
      ipWhitelistEnabled: typeof data.ipWhitelistEnabled === 'boolean' ? data.ipWhitelistEnabled : false,
      ipAddresses: validIps.slice(0, 20), // Max 20 IPs
    };
  }
}

/**
 * Password Service
 */
export class PasswordService {
  static validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};:'",.<>?/\\|`~]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static async hashPassword(password: string): Promise<string> {
    // Simple hash using crypto for demo (use bcrypt in production)
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  static async comparePasswords(password: string, hash: string): Promise<boolean> {
    const inputHash = crypto.createHash('sha256').update(password).digest('hex');
    return inputHash === hash;
  }
}

/**
 * API Key Service
 */
export class ApiKeyService {
  static validateExchange(exchange: string): boolean {
    const validExchanges = ['binance', 'kraken', 'coinbase', 'bybit', 'okx', 'huobi'];
    return validExchanges.includes(exchange.toLowerCase());
  }

  static validateApiKeyFormat(key: string): boolean {
    return key.length >= 20 && key.length <= 200;
  }

  static validateApiSecretFormat(secret: string): boolean {
    return secret.length >= 20 && secret.length <= 500;
  }

  static sanitizeApiKeyName(name: string): string {
    return name.slice(0, 255).trim();
  }

  static maskApiSecret(secret: string): string {
    if (secret.length <= 8) return '****';
    return secret.slice(0, 4) + '****' + secret.slice(-4);
  }
}

/**
 * Email Validation Service
 */
export class EmailService {
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }
}

/**
 * Data Export Service
 */
export class DataExportService {
  static async generateExportReport(userId: string): Promise<object> {
    try {
      const prisma = new PrismaClient();
      
      // Fetch user data
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      return {
        exportDate: new Date().toISOString(),
        user: {
          id: user?.id,
          email: user?.email,
          firstName: user?.firstName,
          lastName: user?.lastName,
          createdAt: user?.createdAt
        },
        preferences: {},
        settings: {
          trading: {},
          dashboard: {},
          advanced: {},
          security: {},
        },
        statistics: {
          totalTrades: 0,
          totalSignals: 0,
          tradesSample: [],
          signalsSample: [],
        },
      };
    } catch (error) {
      throw new Error(`Failed to generate export report: ${error}`);
    }
  }
}
