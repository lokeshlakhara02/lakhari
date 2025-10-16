#!/usr/bin/env node

/**
 * Railway.app Optimized Startup Script
 * Starts the application with Railway-specific optimizations
 */

// Set Railway-specific environment variables
process.env.NODE_ENV = 'production';
process.env.NODE_OPTIONS = '--max-old-space-size=512';
process.env.UV_THREADPOOL_SIZE = '4';

// Railway-specific optimizations
process.env.RAILWAY_OPTIMIZATION = 'true';
process.env.RAILWAY_MEMORY_LIMIT = '512';
process.env.RAILWAY_CPU_LIMIT = '80';
process.env.RAILWAY_NETWORK_LIMIT = '1000';
process.env.RAILWAY_LOG_LIMIT = '50';

// Disable unnecessary features in production
process.env.DISABLE_DEV_TOOLS = 'true';
process.env.DISABLE_DEBUG_LOGS = 'true';
process.env.ENABLE_COST_OPTIMIZATION = 'true';

console.log('🚀 Starting Railway-optimized application...');
console.log('📊 Memory limit:', process.env.NODE_OPTIONS);
console.log('🔧 Thread pool size:', process.env.UV_THREADPOOL_SIZE);
console.log('💰 Cost optimization:', process.env.ENABLE_COST_OPTIMIZATION);

// Start the application
import('./server/index.ts').catch(error => {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
});
