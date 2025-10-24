import cluster from 'cluster';
import os from 'os';
import { log } from './vite';

export function startCluster() {
  const numCPUs = os.cpus().length;
  const maxWorkers = process.env.MAX_WORKERS ? parseInt(process.env.MAX_WORKERS) : Math.min(numCPUs, 4);
  
  if (cluster.isPrimary) {
    log(`Master process ${process.pid} is running`);
    log(`Starting ${maxWorkers} worker processes...`);

    // Fork workers
    for (let i = 0; i < maxWorkers; i++) {
      const worker = cluster.fork();
      log(`Worker ${worker.process.pid} started`);
    }

    // Handle worker exit
    cluster.on('exit', (worker, code, signal) => {
      if (signal) {
        log(`Worker ${worker.process.pid} was killed by signal: ${signal}`);
      } else if (code !== 0) {
        log(`Worker ${worker.process.pid} exited with error code: ${code}`);
      } else {
        log(`Worker ${worker.process.pid} exited successfully`);
      }

      // Restart worker if it crashed
      if (!worker.exitedAfterDisconnect) {
        log(`Restarting worker...`);
        const newWorker = cluster.fork();
        log(`New worker ${newWorker.process.pid} started`);
      }
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      log('Master received SIGTERM, shutting down workers...');
      for (const id in cluster.workers) {
        cluster.workers[id]?.kill();
      }
    });

    process.on('SIGINT', () => {
      log('Master received SIGINT, shutting down workers...');
      for (const id in cluster.workers) {
        cluster.workers[id]?.kill();
      }
    });

  } else {
    // Worker process
    log(`Worker ${process.pid} started`);
    
    // Import and start the server
    require('./index');
    
    // Handle worker shutdown
    process.on('SIGTERM', () => {
      log(`Worker ${process.pid} received SIGTERM, shutting down...`);
      process.exit(0);
    });

    process.on('SIGINT', () => {
      log(`Worker ${process.pid} received SIGINT, shutting down...`);
      process.exit(0);
    });
  }
}

// Export cluster info for monitoring
export function getClusterInfo() {
  if (cluster.isPrimary) {
    return {
      isMaster: true,
      workers: Object.keys(cluster.workers || {}).length,
      maxWorkers: process.env.MAX_WORKERS ? parseInt(process.env.MAX_WORKERS) : Math.min(os.cpus().length, 4),
      cpuCount: os.cpus().length
    };
  } else {
    return {
      isMaster: false,
      workerId: process.pid,
      isWorker: true
    };
  }
}
