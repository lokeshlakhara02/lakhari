/**
 * Performance monitoring utility to track and optimize resource usage
 * Helps reduce Railway costs by monitoring and limiting resource consumption
 */

interface PerformanceMetrics {
  logCount: number;
  errorCount: number;
  warningCount: number;
  connectionAttempts: number;
  lastReset: number;
  memoryUsage: number;
  cpuUsage: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    logCount: 0,
    errorCount: 0,
    warningCount: 0,
    connectionAttempts: 0,
    lastReset: Date.now(),
    memoryUsage: 0,
    cpuUsage: 0
  };

  private maxLogsPerMinute = 100; // Limit logs to reduce Railway rate limits
  private maxErrorsPerMinute = 20; // Limit errors
  private maxWarningsPerMinute = 50; // Limit warnings

  private isProduction = process.env.NODE_ENV === 'production';

  // Track log usage
  trackLog(level: 'error' | 'warn' | 'info' | 'debug') {
    const now = Date.now();
    
    // Reset counters every minute
    if (now - this.metrics.lastReset > 60000) {
      this.metrics.logCount = 0;
      this.metrics.errorCount = 0;
      this.metrics.warningCount = 0;
      this.metrics.connectionAttempts = 0;
      this.metrics.lastReset = now;
    }

    this.metrics.logCount++;

    switch (level) {
      case 'error':
        this.metrics.errorCount++;
        break;
      case 'warn':
        this.metrics.warningCount++;
        break;
    }

    // Check if we're exceeding limits
    if (this.isProduction) {
      if (this.metrics.logCount > this.maxLogsPerMinute) {
        console.warn(`[PERFORMANCE] Log rate limit exceeded: ${this.metrics.logCount} logs/minute`);
        return false;
      }
      if (this.metrics.errorCount > this.maxErrorsPerMinute) {
        console.warn(`[PERFORMANCE] Error rate limit exceeded: ${this.metrics.errorCount} errors/minute`);
        return false;
      }
      if (this.metrics.warningCount > this.maxWarningsPerMinute) {
        console.warn(`[PERFORMANCE] Warning rate limit exceeded: ${this.metrics.warningCount} warnings/minute`);
        return false;
      }
    }

    return true;
  }

  // Track connection attempts
  trackConnectionAttempt() {
    this.metrics.connectionAttempts++;
    
    // Limit connection attempts in production
    if (this.isProduction && this.metrics.connectionAttempts > 10) {
      console.warn(`[PERFORMANCE] Too many connection attempts: ${this.metrics.connectionAttempts}`);
      return false;
    }
    
    return true;
  }

  // Get current metrics
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  // Reset metrics
  resetMetrics() {
    this.metrics = {
      logCount: 0,
      errorCount: 0,
      warningCount: 0,
      connectionAttempts: 0,
      lastReset: Date.now(),
      memoryUsage: 0,
      cpuUsage: 0
    };
  }

  // Check if we should throttle operations
  shouldThrottle(): boolean {
    if (!this.isProduction) return false;
    
    const now = Date.now();
    const timeSinceReset = now - this.metrics.lastReset;
    
    // If we're within the last minute and have high usage, throttle
    if (timeSinceReset < 60000) {
      return this.metrics.logCount > this.maxLogsPerMinute * 0.8 ||
             this.metrics.errorCount > this.maxErrorsPerMinute * 0.8 ||
             this.metrics.warningCount > this.maxWarningsPerMinute * 0.8;
    }
    
    return false;
  }

  // Get performance recommendations
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    
    if (this.metrics.logCount > this.maxLogsPerMinute * 0.5) {
      recommendations.push('Consider reducing log frequency to avoid Railway rate limits');
    }
    
    if (this.metrics.errorCount > this.maxErrorsPerMinute * 0.5) {
      recommendations.push('High error rate detected - check error handling');
    }
    
    if (this.metrics.connectionAttempts > 5) {
      recommendations.push('High connection attempt rate - consider implementing backoff');
    }
    
    return recommendations;
  }
}

export const performanceMonitor = new PerformanceMonitor();
export default performanceMonitor;
