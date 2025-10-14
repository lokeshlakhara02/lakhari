#!/usr/bin/env node

// Simple server startup for Railway
console.log('Starting Lakhari server...');

// Set environment variables
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.PORT = process.env.PORT || 8080;

console.log(`Environment: ${process.env.NODE_ENV}`);
console.log(`Port: ${process.env.PORT}`);

// Import and start the server
import('./server/index.ts').catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
