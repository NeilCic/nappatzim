import { Queue } from 'bullmq';
import { createBullMQConnection } from '../lib/queue.js';
import logger from '../lib/logger.js';

export const progressQueue = new Queue('progress-calculation', {
  connection: createBullMQConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    
    removeOnComplete: {
      age: 3600,
      count: 100,
    },
    
    removeOnFail: {
      age: 86400,
    },
  },
});

progressQueue.on('error', (error) => {
  logger.error({ error }, 'Progress queue error');
});

logger.info('Progress queue initialized');

export default progressQueue;

