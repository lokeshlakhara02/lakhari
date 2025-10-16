/**
 * Optimized logging utility to reduce Railway rate limits
 * Only logs critical errors in production, full logging in development
 */

import { performanceMonitor } from './performance-monitor';
import { costOptimizer } from './cost-optimizer';

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogConfig {
  enableProductionLogs: boolean;
  maxLogsPerSecond: number;
  criticalErrors: string[];
}

const config: LogConfig = {
  enableProductionLogs: false, // Disable most logs in production
  maxLogsPerSecond: 10, // Limit logs per second to avoid Railway rate limits
  criticalErrors: [
    'PERMISSION_DENIED',
    'SECURITY_ERROR', 
    'CONNECTION_FAILED',
    'DEVICE_NOT_FOUND',
    'permission',
    'connection'
  ]
};

class Logger {
  private logCount = 0;
  private lastReset = Date.now();
  private isDevelopment = process.env.NODE_ENV === 'development';

  private shouldLog(level: LogLevel, message: string, errorCode?: string): boolean {
    // Check performance monitor first
    if (!performanceMonitor.trackLog(level)) {
      return false;
    }

    // Check cost optimizer (disabled to prevent circular dependency)
    // const metrics = costOptimizer.getCurrentMetrics();
    // if (metrics.logCount > config.maxLogsPerSecond * 60) {
    //   return false;
    // }

    // Always allow critical errors
    if (errorCode && config.criticalErrors.includes(errorCode)) {
      return true;
    }

    // In development, allow all logs
    if (this.isDevelopment) {
      return true;
    }

    // Check if we should throttle
    if (performanceMonitor.shouldThrottle()) {
      return false;
    }

    return true;
  }

  error(message: string, error?: any, errorCode?: string) {
    if (!this.shouldLog('error', message, errorCode)) return;
    
    if (this.isDevelopment) {
      console.error(`[ERROR] ${message}`, error);
    } else {
      // In production, only log critical errors
      console.error(`[CRITICAL] ${message}`);
    }
  }

  warn(message: string, error?: any, errorCode?: string) {
    if (!this.shouldLog('warn', message, errorCode)) return;
    
    if (this.isDevelopment) {
      console.warn(`[WARN] ${message}`, error);
    }
  }

  info(message: string, data?: any) {
    if (!this.shouldLog('info', message)) return;
    
    if (this.isDevelopment) {
      console.info(`[INFO] ${message}`, data);
    }
  }

  debug(message: string, data?: any) {
    if (!this.shouldLog('debug', message)) return;
    
    if (this.isDevelopment) {
      console.debug(`[DEBUG] ${message}`, data);
    }
  }

  // WebRTC specific logging
  webrtcError(operation: string, message: string, error?: any, errorCode?: string) {
    this.error(`WebRTC ${operation}: ${message}`, error, errorCode);
  }

  webrtcWarn(operation: string, message: string, error?: any) {
    this.warn(`WebRTC ${operation}: ${message}`, error);
  }

  webrtcInfo(operation: string, message: string, data?: any) {
    this.info(`WebRTC ${operation}: ${message}`, data);
  }

  // Video chat specific logging
  videoChatError(type: string, message: string, error?: any) {
    this.error(`VideoChat ${type}: ${message}`, error, type);
  }

  videoChatWarn(type: string, message: string, error?: any) {
    this.warn(`VideoChat ${type}: ${message}`, error);
  }

  videoChatInfo(type: string, message: string, data?: any) {
    this.info(`VideoChat ${type}: ${message}`, data);
  }
}

export const logger = new Logger();
export default logger;
