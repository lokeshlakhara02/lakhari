#!/usr/bin/env node

/**
 * Railway.app Free Tier Optimized Startup Script
 * 
 * This script optimizes the application for Railway's free tier:
 * - 512MB RAM limit
 * - 1 CPU core
 * - 1GB storage
 * - No clustering (single process)
 * - Memory optimization
 * - Reduced logging
 */

const cluster = require('cluster');
const os = require('os');

// Railway free tier limits
const RAILWAY_LIMITS = {
  memoryMB: 400, // Keep 100MB buffer from 512MB limit
  cpuPercent: 70, // Keep 10% buffer from 80% limit
  maxConnections: 40, // Reduced from 50 for safety
  logLevel: 'warn' // Reduce logging in production
};

// Set environment variables for Railway optimization
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.MAX_CONNECTIONS = RAILWAY_LIMITS.maxConnections.toString();
process.env.RATE_LIMIT_MAX = '50'; // Reduced rate limiting
process.env.MAX_WS_CONNECTIONS_PER_IP = '3'; // Reduced WebSocket connections per IP
process.env.ENABLE_REQUEST_LOGGING = 'false'; // Disable request logging
process.env.LOG_LEVEL = RAILWAY_LIMITS.logLevel;

// Memory optimization
if (process.env.NODE_ENV === 'production') {
  // Disable source maps in production
  process.env.GENERATE_SOURCEMAP = 'false';
  
  // Optimize V8 engine
  process.env.NODE_OPTIONS = '--max-old-space-size=400 --optimize-for-size';
  
  // Disable unnecessary features
  process.env.DISABLE_ESLINT_PLUGIN = 'true';
  process.env.SKIP_PREFLIGHT_CHECK = 'true';
}

// Railway-specific optimizations
function optimizeForRailway() {
  console.log('🚀 Optimizing for Railway.app free tier...');
  
  // Set memory limits
  if (global.gc) {
    // Force garbage collection every 30 seconds
    setInterval(() => {
      if (global.gc) {
        global.gc();
      }
    }, 30000);
  }
  
  // Monitor memory usage
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const memMB = memUsage.heapUsed / 1024 / 1024;
    
    if (memMB > RAILWAY_LIMITS.memoryMB * 0.8) {
      console.warn(`⚠️ High memory usage: ${memMB.toFixed(2)}MB`);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }
  }, 10000);
  
  // Reduce logging in production
  if (process.env.NODE_ENV === 'production') {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    
    let logCount = 0;
    const maxLogs = 20; // Limit logs per minute
    
    console.log = (...args) => {
      if (logCount < maxLogs) {
        originalLog(...args);
        logCount++;
      }
    };
    
    console.warn = (...args) => {
      if (logCount < maxLogs) {
        originalWarn(...args);
        logCount++;
      }
    };
    
    console.error = (...args) => {
      // Always log errors, but count them
      originalError(...args);
      logCount++;
    };
    
    // Reset log count every minute
    setInterval(() => {
      logCount = 0;
    }, 60000);
  }
  
  console.log('✅ Railway optimization completed');
}

// Start the application
if (cluster.isMaster) {
  console.log('🚀 Starting OmegleWeb on Railway.app free tier...');
  console.log(`📊 Available CPU cores: ${os.cpus().length}`);
  console.log(`💾 Total memory: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)}GB`);
  console.log(`🔧 Node.js version: ${process.version}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  
  // Railway free tier: single process (no clustering)
  console.log('📝 Running in single process mode (Railway free tier optimization)');
  
  // Apply Railway optimizations
  optimizeForRailway();
  
  // Fork single worker
  const worker = cluster.fork();
  
  // Handle worker events
  worker.on('exit', (code, signal) => {
    if (signal) {
      console.log(`Worker ${worker.process.pid} was killed by signal: ${signal}`);
    } else if (code !== 0) {
      console.log(`Worker ${worker.process.pid} exited with error code: ${code}`);
    } else {
      console.log(`Worker ${worker.process.pid} exited successfully`);
    }
    
    // Restart worker if it crashed
    if (!worker.exitedAfterDisconnect) {
      console.log('🔄 Restarting worker...');
      cluster.fork();
    }
  });
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('📴 Master received SIGTERM, shutting down workers...');
    worker.kill();
  });
  
  process.on('SIGINT', () => {
    console.log('📴 Master received SIGINT, shutting down workers...');
    worker.kill();
  });
  
} else {
  // Worker process
  console.log(`👷 Worker ${process.pid} started`);
  
  // Apply Railway optimizations in worker
  optimizeForRailway();
  
  // Start the server
  require('./server/index.ts');
  
  // Handle worker shutdown
  process.on('SIGTERM', () => {
    console.log(`📴 Worker ${process.pid} received SIGTERM, shutting down...`);
    process.exit(0);
  });
  
  process.on('SIGINT', () => {
    console.log(`📴 Worker ${process.pid} received SIGINT, shutting down...`);
    process.exit(0);
  });
}
