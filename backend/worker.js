import 'dotenv/config';
import './workers/progressWorker.js';
import logger from './lib/logger.js';

logger.info('Worker process started');

process.on('SIGTERM', () => {
  logger.info('Worker process shutting down...');
  process.exit(0);
});

