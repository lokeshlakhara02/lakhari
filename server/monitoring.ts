import { log } from './vite';
import { connectionManager } from './connection-manager';
import { redisStore } from './redis-store';

interface SystemMetrics {
  timestamp: string;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  connections: {
    total: number;
    active: number;
    waiting: Record<string, number>;
  };
  redis: {
    connected: boolean;
    stats: Record<string, any>;
  };
  uptime: number;
  requests: {
    total: number;
    perMinute: number;
    errors: number;
  };
}

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    memory: boolean;
    connections: boolean;
    redis: boolean;
    uptime: boolean;
  };
  timestamp: string;
  details: Record<string, any>;
}

export class MonitoringSystem {
  private metrics: SystemMetrics[] = [];
  private requestCount = 0;
  private errorCount = 0;
  private startTime = Date.now();
  private lastMinuteRequests = 0;
  private lastMinuteTime = Date.now();

  constructor() {
    // Collect metrics every 30 seconds
    setInterval(() => this.collectMetrics(), 30000);
    
    // Clean up old metrics (keep last 24 hours)
    setInterval(() => this.cleanupMetrics(), 300000); // 5 minutes
  }

  private async collectMetrics(): Promise<void> {
    try {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      const metrics: SystemMetrics = {
        timestamp: new Date().toISOString(),
        memory: {
          used: memoryUsage.heapUsed,
          total: memoryUsage.heapTotal,
          percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
        },
        cpu: {
          usage: cpuUsage.user + cpuUsage.system,
          loadAverage: process.platform === 'win32' ? [0, 0, 0] : require('os').loadavg()
        },
        connections: connectionManager.getStats(),
        redis: {
          connected: await redisStore.healthCheck(),
          stats: await redisStore.getStats()
        },
        uptime: Date.now() - this.startTime,
        requests: {
          total: this.requestCount,
          perMinute: this.lastMinuteRequests,
          errors: this.errorCount
        }
      };

      this.metrics.push(metrics);
      
      // Log critical metrics
      if (metrics.memory.percentage > 80) {
        log(`⚠️ High memory usage: ${metrics.memory.percentage.toFixed(2)}%`);
      }
      
      if (metrics.connections.total > 800) {
        log(`⚠️ High connection count: ${metrics.connections.total}`);
      }
      
    } catch (error) {
      log('Error collecting metrics:', error);
    }
  }

  private cleanupMetrics(): void {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    this.metrics = this.metrics.filter(m => 
      new Date(m.timestamp).getTime() > cutoff
    );
  }

  recordRequest(): void {
    this.requestCount++;
    
    // Update per-minute counter
    const now = Date.now();
    if (now - this.lastMinuteTime > 60000) {
      this.lastMinuteRequests = 1;
      this.lastMinuteTime = now;
    } else {
      this.lastMinuteRequests++;
    }
  }

  recordError(): void {
    this.errorCount++;
  }

  async getHealthCheck(): Promise<HealthCheck> {
    const memoryUsage = process.memoryUsage();
    const memoryPercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    const uptime = Date.now() - this.startTime;
    const connectionStats = connectionManager.getStats();
    const redisHealthy = await redisStore.healthCheck();

    const checks = {
      memory: memoryPercentage < 90,
      connections: connectionStats.total < 900,
      redis: redisHealthy,
      uptime: uptime > 60000 // At least 1 minute uptime
    };

    const healthyChecks = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.keys(checks).length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyChecks === totalChecks) {
      status = 'healthy';
    } else if (healthyChecks >= totalChecks * 0.5) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      checks,
      timestamp: new Date().toISOString(),
      details: {
        memory: {
          used: memoryUsage.heapUsed,
          total: memoryUsage.heapTotal,
          percentage: memoryPercentage
        },
        connections: connectionStats,
        uptime,
        requests: {
          total: this.requestCount,
          perMinute: this.lastMinuteRequests,
          errors: this.errorCount
        }
      }
    };
  }

  getMetrics(limit = 100): SystemMetrics[] {
    return this.metrics.slice(-limit);
  }

  getCurrentMetrics(): SystemMetrics | null {
    return this.metrics[this.metrics.length - 1] || null;
  }

  getStats(): Record<string, any> {
    const current = this.getCurrentMetrics();
    if (!current) return {};

    return {
      status: 'running',
      uptime: Date.now() - this.startTime,
      memory: current.memory,
      connections: current.connections,
      requests: current.requests,
      redis: current.redis
    };
  }

  // Alert system
  async checkAlerts(): Promise<void> {
    const current = this.getCurrentMetrics();
    if (!current) return;

    // Memory alert
    if (current.memory.percentage > 85) {
      log(`🚨 CRITICAL: Memory usage at ${current.memory.percentage.toFixed(2)}%`);
      // In production, you would send alerts to monitoring services
    }

    // Connection alert
    if (current.connections.total > 900) {
      log(`🚨 CRITICAL: Connection count at ${current.connections.total}`);
    }

    // Error rate alert
    const errorRate = current.requests.errors / Math.max(current.requests.total, 1);
    if (errorRate > 0.1) { // 10% error rate
      log(`🚨 CRITICAL: High error rate at ${(errorRate * 100).toFixed(2)}%`);
    }

    // Redis connection alert
    if (!current.redis.connected) {
      log(`🚨 CRITICAL: Redis connection lost`);
    }
  }
}

// Global monitoring instance
export const monitoring = new MonitoringSystem();
