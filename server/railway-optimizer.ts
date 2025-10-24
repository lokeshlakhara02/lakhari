import { log } from './vite';

interface RailwayLimits {
  memoryMB: number;
  cpuPercent: number;
  networkRequestsPerMinute: number;
  databaseQueriesPerMinute: number;
  websocketConnections: number;
  logsPerMinute: number;
}

interface RailwayMetrics {
  memoryUsage: number;
  cpuUsage: number;
  networkRequests: number;
  databaseQueries: number;
  websocketConnections: number;
  logCount: number;
  errorCount: number;
}

export class RailwayOptimizer {
  private metrics: RailwayMetrics = {
    memoryUsage: 0,
    cpuUsage: 0,
    networkRequests: 0,
    databaseQueries: 0,
    websocketConnections: 0,
    logCount: 0,
    errorCount: 0
  };

  private limits: RailwayLimits = {
    memoryMB: 400, // Keep 100MB buffer from 512MB limit
    cpuPercent: 70, // Keep 10% buffer from 80% limit
    networkRequestsPerMinute: 800, // Keep 200 buffer from 1000 limit
    databaseQueriesPerMinute: 400, // Keep 100 buffer from 500 limit
    websocketConnections: 40, // Keep 10 buffer from 50 limit
    logsPerMinute: 40 // Keep 10 buffer from 50 limit
  };

  private optimizationInterval: NodeJS.Timeout | null = null;
  private isOptimizing = false;
  private lastOptimization = new Date();

  constructor() {
    this.startOptimization();
  }

  private startOptimization(): void {
    // Check metrics every 30 seconds
    this.optimizationInterval = setInterval(() => {
      this.checkAndOptimize();
    }, 30000);
  }

  private async checkAndOptimize(): Promise<void> {
    if (this.isOptimizing) return;

    const memoryUsage = process.memoryUsage();
    const memoryMB = memoryUsage.heapUsed / 1024 / 1024;

    this.metrics.memoryUsage = memoryMB;
    this.metrics.cpuUsage = process.cpuUsage().user + process.cpuUsage().system;
    this.metrics.websocketConnections = this.getWebSocketConnectionCount();

    // Check if optimization is needed
    const needsOptimization = this.needsOptimization();
    
    if (needsOptimization) {
      this.isOptimizing = true;
      await this.optimize();
      this.isOptimizing = false;
      this.lastOptimization = new Date();
    }
  }

  private needsOptimization(): boolean {
    const memoryCritical = this.metrics.memoryUsage > this.limits.memoryMB * 0.8;
    const cpuCritical = this.metrics.cpuUsage > this.limits.cpuPercent * 0.8;
    const networkCritical = this.metrics.networkRequests > this.limits.networkRequestsPerMinute * 0.8;
    const dbCritical = this.metrics.databaseQueries > this.limits.databaseQueriesPerMinute * 0.8;
    const wsCritical = this.metrics.websocketConnections > this.limits.websocketConnections * 0.8;
    const logCritical = this.metrics.logCount > this.limits.logsPerMinute * 0.8;

    return memoryCritical || cpuCritical || networkCritical || dbCritical || wsCritical || logCritical;
  }

  private async optimize(): Promise<void> {
    log('🚀 Starting Railway optimization...');

    // Memory optimization
    if (this.metrics.memoryUsage > this.limits.memoryMB * 0.7) {
      await this.optimizeMemory();
    }

    // Network optimization
    if (this.metrics.networkRequests > this.limits.networkRequestsPerMinute * 0.7) {
      await this.optimizeNetwork();
    }

    // Database optimization
    if (this.metrics.databaseQueries > this.limits.databaseQueriesPerMinute * 0.7) {
      await this.optimizeDatabase();
    }

    // WebSocket optimization
    if (this.metrics.websocketConnections > this.limits.websocketConnections * 0.7) {
      await this.optimizeWebSockets();
    }

    // Logging optimization
    if (this.metrics.logCount > this.limits.logsPerMinute * 0.7) {
      await this.optimizeLogging();
    }

    log('✅ Railway optimization completed');
  }

  private async optimizeMemory(): Promise<void> {
    log('🧹 Optimizing memory usage...');
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    // Clear unused caches
    this.clearUnusedCaches();
    
    // Optimize large objects
    this.optimizeLargeObjects();
  }

  private async optimizeNetwork(): Promise<void> {
    log('🌐 Optimizing network usage...');
    
    // Reduce polling frequency
    this.reducePollingFrequency();
    
    // Enable request caching
    this.enableRequestCaching();
  }

  private async optimizeDatabase(): Promise<void> {
    log('🗄️ Optimizing database usage...');
    
    // Enable query caching
    this.enableQueryCaching();
    
    // Batch database operations
    this.batchDatabaseOperations();
  }

  private async optimizeWebSockets(): Promise<void> {
    log('🔌 Optimizing WebSocket connections...');
    
    // Close idle connections
    this.closeIdleConnections();
    
    // Pool connections
    this.poolConnections();
  }

  private async optimizeLogging(): Promise<void> {
    log('📝 Optimizing logging...');
    
    // Disable non-critical logs
    this.disableNonCriticalLogs();
    
    // Batch logs
    this.batchLogs();
  }

  private clearUnusedCaches(): void {
    // Clear any application-specific caches
    if (typeof global !== 'undefined') {
      // Clear global caches if they exist
      Object.keys(global).forEach(key => {
        if (key.includes('cache') || key.includes('temp')) {
          delete (global as any)[key];
        }
      });
    }
  }

  private optimizeLargeObjects(): void {
    // Optimize any large data structures
    // This would be application-specific
  }

  private reducePollingFrequency(): void {
    // Reduce the frequency of any polling operations
    // This would be application-specific
  }

  private enableRequestCaching(): void {
    // Enable caching for frequently requested data
    // This would be application-specific
  }

  private enableQueryCaching(): void {
    // Enable database query caching
    // This would be application-specific
  }

  private batchDatabaseOperations(): void {
    // Batch multiple database operations together
    // This would be application-specific
  }

  private closeIdleConnections(): void {
    // Close idle WebSocket connections
    // This would be application-specific
  }

  private poolConnections(): void {
    // Implement connection pooling
    // This would be application-specific
  }

  private disableNonCriticalLogs(): void {
    // Disable non-critical logging in production
    if (process.env.NODE_ENV === 'production') {
      // Override console methods to reduce logging
      const originalLog = console.log;
      const originalWarn = console.warn;
      const originalError = console.error;

      console.log = (...args) => {
        if (this.metrics.logCount < this.limits.logsPerMinute * 0.5) {
          originalLog(...args);
        }
      };

      console.warn = (...args) => {
        if (this.metrics.logCount < this.limits.logsPerMinute * 0.7) {
          originalWarn(...args);
        }
      };

      console.error = (...args) => {
        // Always log errors, but count them
        originalError(...args);
      };
    }
  }

  private batchLogs(): void {
    // Implement log batching to reduce I/O
    // This would be application-specific
  }

  private getWebSocketConnectionCount(): number {
    // This would be implemented based on your WebSocket connection tracking
    return 0; // Placeholder
  }

  // Public methods for external monitoring
  trackNetworkRequest(): void {
    this.metrics.networkRequests++;
  }

  trackDatabaseQuery(): void {
    this.metrics.databaseQueries++;
  }

  trackLog(): void {
    this.metrics.logCount++;
  }

  trackError(): void {
    this.metrics.errorCount++;
  }

  getMetrics(): RailwayMetrics {
    return { ...this.metrics };
  }

  getLimits(): RailwayLimits {
    return { ...this.limits };
  }

  isWithinLimits(): boolean {
    return (
      this.metrics.memoryUsage < this.limits.memoryMB &&
      this.metrics.cpuUsage < this.limits.cpuPercent &&
      this.metrics.networkRequests < this.limits.networkRequestsPerMinute &&
      this.metrics.databaseQueries < this.limits.databaseQueriesPerMinute &&
      this.metrics.websocketConnections < this.limits.websocketConnections &&
      this.metrics.logCount < this.limits.logsPerMinute
    );
  }

  getRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.metrics.memoryUsage > this.limits.memoryMB * 0.8) {
      recommendations.push('High memory usage detected. Consider reducing cache sizes or implementing memory optimization.');
    }

    if (this.metrics.cpuUsage > this.limits.cpuPercent * 0.8) {
      recommendations.push('High CPU usage detected. Consider optimizing algorithms or reducing processing load.');
    }

    if (this.metrics.networkRequests > this.limits.networkRequestsPerMinute * 0.8) {
      recommendations.push('High network request count. Consider implementing request caching or reducing API calls.');
    }

    if (this.metrics.databaseQueries > this.limits.databaseQueriesPerMinute * 0.8) {
      recommendations.push('High database query count. Consider implementing query caching or optimizing database operations.');
    }

    if (this.metrics.websocketConnections > this.limits.websocketConnections * 0.8) {
      recommendations.push('High WebSocket connection count. Consider implementing connection pooling or reducing concurrent connections.');
    }

    if (this.metrics.logCount > this.limits.logsPerMinute * 0.8) {
      recommendations.push('High log count. Consider reducing logging frequency or implementing log batching.');
    }

    return recommendations;
  }

  stop(): void {
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
      this.optimizationInterval = null;
    }
  }
}

// Global Railway optimizer instance
export const railwayOptimizer = new RailwayOptimizer();
