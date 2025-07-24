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
  BOT_MAIN: 'bot_main',    // Main bot process that handles WhatsApp connection
  BOT_WORKER: 'bot_worker', // Additional bot workers for parallel processing
  WORKER: 'worker'
};

// Function to determine if a process should run in cluster mode
if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} is running`);
  console.log(`Available CPUs: ${numCPUs}`);
  console.log(`Clustering enabled. Starting ${workerCount} workers`);
  
  // Configure worker distribution - only bot workers now
  const botWorkerCount = workerCount;
  
  console.log(`Allocating ${botWorkerCount} bot workers`);
  
  // Start one dedicated process for the main WhatsApp bot connection
  const botMainWorker = cluster.fork({ 
    PROCESS_ROLE: ROLES.BOT_MAIN,
    BOT_WORKER_COUNT: botWorkerCount - 1  // Inform main bot about other bot workers
  });
  console.log(`Started WhatsApp bot main worker (PID: ${botMainWorker.process.pid})`);
  
  // Start additional bot worker processes for parallel tasks
  if (botWorkerCount > 1) {
    for (let i = 0; i < botWorkerCount - 1; i++) {
      const botWorker = cluster.fork({ 
        PROCESS_ROLE: ROLES.BOT_WORKER,
        BOT_WORKER_ID: i + 1
      });
      console.log(`Started WhatsApp bot worker ${i+1} (PID: ${botWorker.process.pid})`);
    }
  }
  
  // Listen for workers coming online
  cluster.on('online', (worker) => {
    console.log(`Worker ${worker.process.pid} is online`);
  });
  
  // Set up IPC message handling between workers
  Object.values(cluster.workers).forEach(worker => {
    worker.on('message', (msg) => {
      // Forward messages to appropriate workers based on their type
      if (msg.type === 'bot_command') {
        // Send bot commands to the main bot worker
        const botWorker = Object.values(cluster.workers).find(
          w => w.process.env.PROCESS_ROLE === ROLES.BOT_MAIN
        );
        if (botWorker) {
          botWorker.send(msg);
        }
      } else if (msg.type === 'task_dispatch') {
        // Distribute tasks to available bot workers
        const botWorkers = Object.values(cluster.workers).filter(
          w => w.process.env.PROCESS_ROLE === ROLES.BOT_WORKER
        );
        
        if (botWorkers.length > 0) {
          // Simple round-robin distribution
          const targetWorker = botWorkers[msg.taskId % botWorkers.length];
          targetWorker.send(msg);
        }
      }
    });
  });
  
  // Handle worker crashes
  cluster.on('exit', (worker, code, signal) => {
    const role = worker.process?.env?.PROCESS_ROLE || 'unknown';
    console.log(`Worker ${worker.process.pid} (${role}) died with code: ${code} and signal: ${signal}`);
    
    // Restart the appropriate type of worker
    if (role === ROLES.BOT_MAIN) {
      console.log('Restarting WhatsApp bot main worker...');
      const newBotWorker = cluster.fork({ 
        PROCESS_ROLE: ROLES.BOT_MAIN,
        BOT_WORKER_COUNT: botWorkerCount - 1
      });
      console.log(`Started new WhatsApp bot main worker (PID: ${newBotWorker.process.pid})`);
    } else if (role === ROLES.BOT_WORKER) {
      const workerId = worker.process?.env?.BOT_WORKER_ID || 'unknown';
      console.log(`Restarting WhatsApp bot worker ${workerId}...`);
      const newBotWorker = cluster.fork({ 
        PROCESS_ROLE: ROLES.BOT_WORKER,
        BOT_WORKER_ID: workerId
      });
      console.log(`Started new WhatsApp bot worker ${workerId} (PID: ${newBotWorker.process.pid})`);
    }
  });
} else {
  // This is a worker process
  console.log(`Worker ${process.pid} started with role: ${process.env.PROCESS_ROLE}`);
  
  // Setup IPC message handling for this worker
  process.on('message', (msg) => {
    console.log(`Worker ${process.pid} received message of type: ${msg.type}`);
    // Handle messages based on worker role
    // This provides a communication channel between processes
  });
  
  try {
    // Route to the appropriate startup file based on the worker's role
    if (process.env.PROCESS_ROLE === ROLES.BOT_MAIN || process.env.PROCESS_ROLE === ROLES.BOT_WORKER) {
      // Set environment variables to control bot behavior based on role
      const isMainWorker = process.env.PROCESS_ROLE === ROLES.BOT_MAIN;
      
      // Set global variables to indicate role before loading the bot
      global.CLUSTER_MODE = true;
      global.IS_PRIMARY_BOT = isMainWorker;
      global.BOT_WORKER_ID = isMainWorker ? 0 : parseInt(process.env.BOT_WORKER_ID);
      global.BOT_WORKER_COUNT = isMainWorker ? 
        parseInt(process.env.BOT_WORKER_COUNT || '0') + 1 : 
        0; // Main worker knows about all workers
        
      console.log(`Worker ${process.pid} starting WhatsApp bot as ${isMainWorker ? 'main connection' : 'worker'} #${global.BOT_WORKER_ID}...`);
      await import('./index.js');
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
