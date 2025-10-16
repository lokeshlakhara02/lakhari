/**
 * Memory Optimization System for Railway.app
 * Reduces memory usage to minimize Railway costs
 */

interface MemoryStats {
  used: number;
  total: number;
  percentage: number;
  timestamp: Date;
}

class MemoryOptimizer {
  private memoryStats: MemoryStats[] = [];
  private maxMemoryMB = 512; // Railway basic plan limit
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isOptimizing = false;

  constructor() {
    this.startMonitoring();
  }

  // Start memory monitoring
  private startMonitoring() {
    this.cleanupInterval = setInterval(() => {
      this.optimizeMemory();
    }, 60000); // Check every minute
  }

  // Get current memory usage
  getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed / (1024 * 1024); // MB
    }
    return 0;
  }

  // Track memory usage
  trackMemoryUsage() {
    const used = this.getMemoryUsage();
    const stats: MemoryStats = {
      used,
      total: this.maxMemoryMB,
      percentage: (used / this.maxMemoryMB) * 100,
      timestamp: new Date()
    };
    
    this.memoryStats.push(stats);
    
    // Keep only last 10 measurements
    if (this.memoryStats.length > 10) {
      this.memoryStats.shift();
    }
    
    // Trigger optimization if memory usage is high
    if (stats.percentage > 70) {
      this.optimizeMemory();
    }
  }

  // Main memory optimization
  private optimizeMemory() {
    if (this.isOptimizing) return;
    
    this.isOptimizing = true;
    
    try {
      const currentUsage = this.getMemoryUsage();
      const percentage = (currentUsage / this.maxMemoryMB) * 100;
      
      if (percentage > 80) {
        console.warn(`[MEMORY] High usage detected: ${currentUsage.toFixed(2)}MB (${percentage.toFixed(1)}%)`);
        this.aggressiveOptimization();
      } else if (percentage > 60) {
        console.info(`[MEMORY] Moderate usage: ${currentUsage.toFixed(2)}MB (${percentage.toFixed(1)}%)`);
        this.moderateOptimization();
      }
      
    } finally {
      this.isOptimizing = false;
    }
  }

  // Moderate memory optimization
  private moderateOptimization() {
    // Clear unused caches
    this.clearUnusedCaches();
    
    // Optimize arrays and objects
    this.optimizeDataStructures();
    
    // Clear old logs
    this.clearOldLogs();
  }

  // Aggressive memory optimization
  private aggressiveOptimization() {
    // Force garbage collection if available
    if (typeof global !== 'undefined' && global.gc) {
      console.log('[MEMORY] Forcing garbage collection');
      global.gc();
    }
    
    // Clear all caches
    this.clearAllCaches();
    
    // Optimize all data structures
    this.optimizeAllDataStructures();
    
    // Clear old data
    this.clearOldData();
    
    // Reduce object sizes
    this.reduceObjectSizes();
  }

  // Clear unused caches
  private clearUnusedCaches() {
    // Clear browser caches if in browser environment
    if (typeof window !== 'undefined' && 'caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          if (name.includes('old') || name.includes('unused') || name.includes('temp')) {
            caches.delete(name);
          }
        });
      });
    }
    
    // Clear any application caches
    this.clearApplicationCaches();
  }

  // Clear all caches
  private clearAllCaches() {
    // Clear browser caches
    if (typeof window !== 'undefined' && 'caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    
    // Clear all application caches
    this.clearAllApplicationCaches();
  }

  // Clear application caches
  private clearApplicationCaches() {
    // This would be implemented based on your specific caches
    // For example:
    // - Clear WebRTC connection caches
    // - Clear message caches
    // - Clear user session caches
  }

  // Clear all application caches
  private clearAllApplicationCaches() {
    // Clear all application caches aggressively
    // This would be implemented based on your specific caches
  }

  // Optimize data structures
  private optimizeDataStructures() {
    // Optimize arrays by removing empty elements
    this.optimizeArrays();
    
    // Optimize objects by removing unused properties
    this.optimizeObjects();
    
    // Compress large data structures
    this.compressLargeStructures();
  }

  // Optimize all data structures
  private optimizeAllDataStructures() {
    // Aggressive optimization of all data structures
    this.aggressiveArrayOptimization();
    this.aggressiveObjectOptimization();
    this.aggressiveCompression();
  }

  // Optimize arrays
  private optimizeArrays() {
    // Remove empty elements from arrays
    // This would be implemented based on your specific arrays
  }

  // Optimize objects
  private optimizeObjects() {
    // Remove unused properties from objects
    // This would be implemented based on your specific objects
  }

  // Compress large structures
  private compressLargeStructures() {
    // Compress large data structures
    // This would be implemented based on your specific structures
  }

  // Aggressive array optimization
  private aggressiveArrayOptimization() {
    // Aggressive array optimization
    // This would be implemented based on your specific arrays
  }

  // Aggressive object optimization
  private aggressiveObjectOptimization() {
    // Aggressive object optimization
    // This would be implemented based on your specific objects
  }

  // Aggressive compression
  private aggressiveCompression() {
    // Aggressive compression of all data structures
    // This would be implemented based on your specific structures
  }

  // Clear old logs
  private clearOldLogs() {
    // Clear old log entries
    // This would be implemented in your logging system
  }

  // Clear old data
  private clearOldData() {
    // Clear old data that's no longer needed
    // This would be implemented based on your specific data
  }

  // Reduce object sizes
  private reduceObjectSizes() {
    // Reduce the size of objects
    // This would be implemented based on your specific objects
  }

  // Get memory statistics
  getMemoryStats(): MemoryStats[] {
    return [...this.memoryStats];
  }

  // Get current memory percentage
  getCurrentMemoryPercentage(): number {
    const usage = this.getMemoryUsage();
    return (usage / this.maxMemoryMB) * 100;
  }

  // Check if memory usage is critical
  isMemoryCritical(): boolean {
    return this.getCurrentMemoryPercentage() > 90;
  }

  // Check if memory usage is high
  isMemoryHigh(): boolean {
    return this.getCurrentMemoryPercentage() > 70;
  }

  // Get memory optimization recommendations
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    const percentage = this.getCurrentMemoryPercentage();
    
    if (percentage > 90) {
      recommendations.push('CRITICAL: Memory usage is very high - immediate optimization required');
    } else if (percentage > 80) {
      recommendations.push('HIGH: Memory usage is high - consider aggressive optimization');
    } else if (percentage > 70) {
      recommendations.push('MODERATE: Memory usage is moderate - consider optimization');
    }
    
    if (this.memoryStats.length > 5) {
      const avgUsage = this.memoryStats.reduce((sum, stat) => sum + stat.percentage, 0) / this.memoryStats.length;
      if (avgUsage > 60) {
        recommendations.push('Consider implementing memory pooling for frequently used objects');
      }
    }
    
    return recommendations;
  }

  // Stop monitoring
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

export const memoryOptimizer = new MemoryOptimizer();
export default memoryOptimizer;
