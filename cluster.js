import cluster from 'cluster';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import path from 'path';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, 'config.env') });

const numCPUs = os.cpus().length;
// Always use clustering, but allow configuring worker count
const WORKERS = process.env.CLUSTER_WORKERS ? parseInt(process.env.CLUSTER_WORKERS) : numCPUs;

// Determine the number of workers to use (capped at available CPUs)
const workerCount = WORKERS > 0 && WORKERS <= numCPUs ? WORKERS : numCPUs;

// Process-specific roles
const ROLES = {
  PRIMARY: 'primary',
  BOT: 'bot',
  ADMIN: 'admin',
  WORKER: 'worker'
};

// Function to determine if a process should run in cluster mode
if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} is running`);
  console.log(`Available CPUs: ${numCPUs}`);
  console.log(`Clustering enabled. Starting ${workerCount} workers`);
  
  // Start one dedicated process for the WhatsApp bot
  const botWorker = cluster.fork({ PROCESS_ROLE: ROLES.BOT });
  console.log(`Started WhatsApp bot worker (PID: ${botWorker.process.pid})`);
  
  // Start admin panel workers for the remaining cores
  const adminWorkerCount = Math.max(1, workerCount - 1);
  console.log(`Starting ${adminWorkerCount} admin panel workers`);
  
  for (let i = 0; i < adminWorkerCount; i++) {
    const adminWorker = cluster.fork({ PROCESS_ROLE: ROLES.ADMIN });
    console.log(`Started admin panel worker ${i+1} (PID: ${adminWorker.process.pid})`);
  }
  
  // Listen for workers coming online
  cluster.on('online', (worker) => {
    console.log(`Worker ${worker.process.pid} is online`);
  });
  
  // Handle worker crashes
  cluster.on('exit', (worker, code, signal) => {
    const role = worker.process.env.PROCESS_ROLE;
    console.log(`Worker ${worker.process.pid} (${role}) died with code: ${code} and signal: ${signal}`);
    
    // Restart the appropriate type of worker
    if (role === ROLES.BOT) {
      console.log('Restarting WhatsApp bot worker...');
      const newBotWorker = cluster.fork({ PROCESS_ROLE: ROLES.BOT });
      console.log(`Started new WhatsApp bot worker (PID: ${newBotWorker.process.pid})`);
    } else {
      console.log('Restarting admin panel worker...');
      const newAdminWorker = cluster.fork({ PROCESS_ROLE: ROLES.ADMIN });
      console.log(`Started new admin panel worker (PID: ${newAdminWorker.process.pid})`);
    }
  });
} else {
  // This is a worker process
  console.log(`Worker ${process.pid} started with role: ${process.env.PROCESS_ROLE}`);
  
  try {
    // Route to the appropriate startup file based on the worker's role
    if (process.env.PROCESS_ROLE === ROLES.BOT) {
      console.log(`Worker ${process.pid} starting WhatsApp bot...`);
      await import('./index.js');
    } else if (process.env.PROCESS_ROLE === ROLES.ADMIN) {
      console.log(`Worker ${process.pid} starting admin panel...`);
      await import('./admin/server.js');
    } else {
      console.error(`Unknown role: ${process.env.PROCESS_ROLE}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error in worker ${process.pid}:`, error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(`Uncaught exception in process ${process.pid}:`, error);
  // Don't exit the process here to maintain stability
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error(`Unhandled rejection in process ${process.pid}:`, reason);
  // Don't exit the process here to maintain stability
});
