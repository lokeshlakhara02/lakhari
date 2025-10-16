/**
 * Network Optimization System for Railway.app
 * Reduces network usage to minimize Railway costs
 */

interface NetworkStats {
  requests: number;
  bytesTransferred: number;
  timestamp: Date;
}

interface RequestCache {
  url: string;
  data: any;
  timestamp: Date;
  ttl: number;
}

class NetworkOptimizer {
  private networkStats: NetworkStats[] = [];
  private requestCache = new Map<string, RequestCache>();
  private maxRequestsPerMinute = 1000;
  private maxBytesPerMinute = 10 * 1024 * 1024; // 10MB
  private cacheTTL = 300000; // 5 minutes
  private isOptimizing = false;

  constructor() {
    this.startMonitoring();
  }

  // Start network monitoring
  private startMonitoring() {
    setInterval(() => {
      this.optimizeNetwork();
    }, 60000); // Check every minute
  }

  // Track network request
  trackRequest(url: string, bytes: number = 0) {
    const stats: NetworkStats = {
      requests: 1,
      bytesTransferred: bytes,
      timestamp: new Date()
    };
    
    this.networkStats.push(stats);
    
    // Keep only last 10 measurements
    if (this.networkStats.length > 10) {
      this.networkStats.shift();
    }
    
    // Check if we need to optimize
    const totalRequests = this.getTotalRequests();
    const totalBytes = this.getTotalBytes();
    
    if (totalRequests > this.maxRequestsPerMinute * 0.8) {
      this.optimizeRequests();
    }
    
    if (totalBytes > this.maxBytesPerMinute * 0.8) {
      this.optimizeDataTransfer();
    }
  }

  // Get total requests in last minute
  private getTotalRequests(): number {
    const oneMinuteAgo = new Date(Date.now() - 60000);
    return this.networkStats
      .filter(stat => stat.timestamp > oneMinuteAgo)
      .reduce((sum, stat) => sum + stat.requests, 0);
  }

  // Get total bytes in last minute
  private getTotalBytes(): number {
    const oneMinuteAgo = new Date(Date.now() - 60000);
    return this.networkStats
      .filter(stat => stat.timestamp > oneMinuteAgo)
      .reduce((sum, stat) => sum + stat.bytesTransferred, 0);
  }

  // Main network optimization
  private optimizeNetwork() {
    if (this.isOptimizing) return;
    
    this.isOptimizing = true;
    
    try {
      const totalRequests = this.getTotalRequests();
      const totalBytes = this.getTotalBytes();
      
      if (totalRequests > this.maxRequestsPerMinute * 0.8) {
        console.warn(`[NETWORK] High request count: ${totalRequests} requests/minute`);
        this.optimizeRequests();
      }
      
      if (totalBytes > this.maxBytesPerMinute * 0.8) {
        console.warn(`[NETWORK] High data transfer: ${(totalBytes / 1024 / 1024).toFixed(2)}MB/minute`);
        this.optimizeDataTransfer();
      }
      
    } finally {
      this.isOptimizing = false;
    }
  }

  // Optimize requests
  private optimizeRequests() {
    // Implement request batching
    this.batchRequests();
    
    // Implement request caching
    this.enableRequestCaching();
    
    // Reduce polling frequency
    this.reducePollingFrequency();
  }

  // Optimize data transfer
  private optimizeDataTransfer() {
    // Compress data
    this.compressData();
    
    // Implement data caching
    this.enableDataCaching();
    
    // Reduce data size
    this.reduceDataSize();
  }

  // Batch requests
  private batchRequests() {
    // This would be implemented based on your specific request patterns
    // For example, batching multiple API calls into single requests
  }

  // Enable request caching
  private enableRequestCaching() {
    // This would be implemented based on your specific caching needs
    // For example, caching API responses
  }

  // Reduce polling frequency
  private reducePollingFrequency() {
    // This would be implemented based on your specific polling logic
    // For example, reducing the frequency of status checks
  }

  // Compress data
  private compressData() {
    // This would be implemented based on your specific data compression needs
    // For example, compressing large payloads
  }

  // Enable data caching
  private enableDataCaching() {
    // This would be implemented based on your specific data caching needs
    // For example, caching large data sets
  }

  // Reduce data size
  private reduceDataSize() {
    // This would be implemented based on your specific data size reduction needs
    // For example, removing unnecessary data from responses
  }

  // Cache request
  cacheRequest(url: string, data: any, ttl: number = this.cacheTTL) {
    const cacheEntry: RequestCache = {
      url,
      data,
      timestamp: new Date(),
      ttl
    };
    
    this.requestCache.set(url, cacheEntry);
  }

  // Get cached request
  getCachedRequest(url: string): any | null {
    const cacheEntry = this.requestCache.get(url);
    
    if (!cacheEntry) {
      return null;
    }
    
    // Check if cache is expired
    const now = new Date();
    const age = now.getTime() - cacheEntry.timestamp.getTime();
    
    if (age > cacheEntry.ttl) {
      this.requestCache.delete(url);
      return null;
    }
    
    return cacheEntry.data;
  }

  // Clear expired cache entries
  private clearExpiredCache() {
    const now = new Date();
    
    for (const [url, cacheEntry] of Array.from(this.requestCache.entries())) {
      const age = now.getTime() - cacheEntry.timestamp.getTime();
      
      if (age > cacheEntry.ttl) {
        this.requestCache.delete(url);
      }
    }
  }

  // Get network statistics
  getNetworkStats(): NetworkStats[] {
    return [...this.networkStats];
  }

  // Get current request rate
  getCurrentRequestRate(): number {
    return this.getTotalRequests();
  }

  // Get current data transfer rate
  getCurrentDataTransferRate(): number {
    return this.getTotalBytes();
  }

  // Check if network usage is critical
  isNetworkCritical(): boolean {
    return this.getCurrentRequestRate() > this.maxRequestsPerMinute * 0.9 ||
           this.getCurrentDataTransferRate() > this.maxBytesPerMinute * 0.9;
  }

  // Check if network usage is high
  isNetworkHigh(): boolean {
    return this.getCurrentRequestRate() > this.maxRequestsPerMinute * 0.7 ||
           this.getCurrentDataTransferRate() > this.maxBytesPerMinute * 0.7;
  }

  // Get network optimization recommendations
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    const requestRate = this.getCurrentRequestRate();
    const dataRate = this.getCurrentDataTransferRate();
    
    if (requestRate > this.maxRequestsPerMinute * 0.8) {
      recommendations.push('HIGH: Request rate is high - consider implementing request batching');
    }
    
    if (dataRate > this.maxBytesPerMinute * 0.8) {
      recommendations.push('HIGH: Data transfer rate is high - consider implementing data compression');
    }
    
    if (this.requestCache.size > 100) {
      recommendations.push('Consider clearing old cache entries to free up memory');
    }
    
    return recommendations;
  }

  // Clear all caches
  clearAllCaches() {
    this.requestCache.clear();
  }

  // Stop monitoring
  stop() {
    // Stop any monitoring intervals
  }
}

export const networkOptimizer = new NetworkOptimizer();
export default networkOptimizer;
