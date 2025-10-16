/**
 * Comprehensive Cost Optimization System for Railway.app
 * Integrates all optimization systems to minimize Railway costs
 */

// Temporarily disable imports to prevent circular dependency issues
// import { railwayOptimizer } from './railway-optimizer';
// import { memoryOptimizer } from './memory-optimizer';
// import { networkOptimizer } from './network-optimizer';
import { performanceMonitor } from './performance-monitor';
import { logger } from './logger';

interface CostMetrics {
  memoryUsage: number;
  networkRequests: number;
  databaseQueries: number;
  websocketConnections: number;
  logCount: number;
  errorCount: number;
  estimatedCost: number;
  optimizationLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface OptimizationStrategy {
  name: string;
  priority: number;
  costSavings: number;
  implementation: () => void;
}

class CostOptimizer {
  private strategies: OptimizationStrategy[] = [];
  private isOptimizing = false;
  private optimizationInterval: NodeJS.Timeout | null = null;
  private lastOptimization = new Date();

  constructor() {
    this.initializeStrategies();
    // Temporarily disable automatic optimization to prevent circular dependency
    // this.startOptimization();
  }

  // Initialize optimization strategies
  private initializeStrategies() {
    this.strategies = [
      {
        name: 'Reduce Logging',
        priority: 1,
        costSavings: 0.3,
        implementation: () => this.reduceLogging()
      },
      {
        name: 'Optimize Memory',
        priority: 2,
        costSavings: 0.4,
        implementation: () => this.optimizeMemory()
      },
      {
        name: 'Optimize Network',
        priority: 3,
        costSavings: 0.2,
        implementation: () => this.optimizeNetwork()
      },
      {
        name: 'Optimize Database',
        priority: 4,
        costSavings: 0.3,
        implementation: () => this.optimizeDatabase()
      },
      {
        name: 'Optimize WebSockets',
        priority: 5,
        costSavings: 0.2,
        implementation: () => this.optimizeWebSockets()
      },
      {
        name: 'Aggressive Optimization',
        priority: 6,
        costSavings: 0.5,
        implementation: () => this.aggressiveOptimization()
      }
    ];
  }

  // Start optimization process
  private startOptimization() {
    this.optimizationInterval = setInterval(() => {
      this.runOptimization();
    }, 120000); // Run every 2 minutes
  }

  // Main optimization process
  private runOptimization() {
    if (this.isOptimizing) return;
    
    this.isOptimizing = true;
    
    try {
      const metrics = this.getCurrentMetrics();
      const optimizationLevel = this.determineOptimizationLevel(metrics);
      
      logger.info('cost_optimizer', `Running optimization - Level: ${optimizationLevel}`);
      
      // Run strategies based on optimization level
      this.runStrategies(optimizationLevel);
      
      this.lastOptimization = new Date();
      
    } finally {
      this.isOptimizing = false;
    }
  }

  // Determine optimization level based on metrics
  private determineOptimizationLevel(metrics: CostMetrics): 'low' | 'medium' | 'high' | 'critical' {
    if (metrics.memoryUsage > 90 || metrics.networkRequests > 800 || metrics.logCount > 40) {
      return 'critical';
    } else if (metrics.memoryUsage > 70 || metrics.networkRequests > 600 || metrics.logCount > 30) {
      return 'high';
    } else if (metrics.memoryUsage > 50 || metrics.networkRequests > 400 || metrics.logCount > 20) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  // Run optimization strategies
  private runStrategies(level: 'low' | 'medium' | 'high' | 'critical') {
    const strategiesToRun = this.strategies.filter(strategy => {
      switch (level) {
        case 'critical':
          return strategy.priority <= 6;
        case 'high':
          return strategy.priority <= 5;
        case 'medium':
          return strategy.priority <= 3;
        case 'low':
          return strategy.priority <= 2;
        default:
          return false;
      }
    });

    strategiesToRun.forEach(strategy => {
      try {
        logger.info('cost_optimizer', `Running strategy: ${strategy.name}`);
        strategy.implementation();
      } catch (error) {
        logger.error(`Failed to run strategy ${strategy.name}`, error);
      }
    });
  }

  // Get current cost metrics (simplified to prevent circular dependency)
  getCurrentMetrics(): CostMetrics {
    // Return default values to prevent circular dependency
    return {
      memoryUsage: 0,
      networkRequests: 0,
      databaseQueries: 0,
      websocketConnections: 0,
      logCount: 0,
      errorCount: 0,
      estimatedCost: 5, // Base Railway cost
      optimizationLevel: 'low'
    };
  }

  // Calculate estimated cost based on usage (simplified)
  private calculateEstimatedCost(): number {
    return 5; // Base Railway cost
  }

  // Direct cost calculation without circular dependency
  private calculateEstimatedCostDirect(
    memoryUsage: number,
    networkRequests: number,
    railwayMetrics: { databaseQueries: number; websocketConnections: number; logCount: number; errorCount: number }
  ): number {
    let cost = 0;
    
    // Base cost for Railway basic plan
    cost += 5; // $5/month base
    
    // Memory usage cost
    if (memoryUsage > 80) {
      cost += 2; // Additional cost for high memory usage
    }
    
    // Network usage cost
    if (networkRequests > 600) {
      cost += 1; // Additional cost for high network usage
    }
    
    // Log volume cost
    if (railwayMetrics.logCount > 30) {
      cost += 1; // Additional cost for high log volume
    }
    
    return cost;
  }

  // Optimization strategies implementation
  private reduceLogging() {
    // Disable non-critical logs
    logger.info('cost_optimizer', 'Reducing logging to save costs');
    
    // This would be implemented in your logging system
    // For example, disabling debug logs, reducing log verbosity, etc.
  }

  private optimizeMemory() {
    logger.info('cost_optimizer', 'Optimizing memory usage');
    memoryOptimizer.trackMemoryUsage();
  }

  private optimizeNetwork() {
    logger.info('cost_optimizer', 'Optimizing network usage');
    networkOptimizer.trackRequest('optimization', 0);
  }

  private optimizeDatabase() {
    logger.info('cost_optimizer', 'Optimizing database usage');
    railwayOptimizer.trackDatabaseQuery();
  }

  private optimizeWebSockets() {
    logger.info('cost_optimizer', 'Optimizing WebSocket usage');
    railwayOptimizer.trackWebSocketConnection();
  }

  private aggressiveOptimization() {
    logger.info('cost_optimizer', 'Running aggressive optimization');
    
    // Force garbage collection
    if (typeof global !== 'undefined' && global.gc) {
      global.gc();
    }
    
    // Clear all caches
    networkOptimizer.clearAllCaches();
    
    // Reset all metrics
    railwayOptimizer.resetMetrics();
    memoryOptimizer.stop();
    networkOptimizer.stop();
  }

  // Get optimization recommendations
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    const metrics = this.getCurrentMetrics();
    
    if (metrics.memoryUsage > 70) {
      recommendations.push('HIGH: Memory usage is high - consider reducing object sizes');
    }
    
    if (metrics.networkRequests > 600) {
      recommendations.push('HIGH: Network usage is high - consider implementing request batching');
    }
    
    if (metrics.logCount > 30) {
      recommendations.push('HIGH: Log volume is high - consider reducing log verbosity');
    }
    
    if (metrics.databaseQueries > 300) {
      recommendations.push('HIGH: Database usage is high - consider implementing query caching');
    }
    
    if (metrics.websocketConnections > 30) {
      recommendations.push('HIGH: WebSocket usage is high - consider implementing connection pooling');
    }
    
    return recommendations;
  }

  // Get cost savings estimate
  getCostSavings(): number {
    const currentCost = this.calculateEstimatedCost();
    const baseCost = 5; // Railway basic plan
    return Math.max(0, currentCost - baseCost);
  }

  // Get optimization status
  getOptimizationStatus() {
    return {
      isOptimizing: this.isOptimizing,
      lastOptimization: this.lastOptimization,
      strategies: this.strategies.length,
      metrics: this.getCurrentMetrics(),
      recommendations: this.getRecommendations(),
      costSavings: this.getCostSavings()
    };
  }

  // Stop optimization
  stop() {
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
      this.optimizationInterval = null;
    }
    
    railwayOptimizer.stop();
    memoryOptimizer.stop();
    networkOptimizer.stop();
  }
}

export const costOptimizer = new CostOptimizer();
export default costOptimizer;
