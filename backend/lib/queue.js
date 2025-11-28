import Redis from 'ioredis';
import logger from './logger.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Create a dedicated Redis connection for BullMQ
// BullMQ recommends separate connections for Queue and Worker
export const createRedisConnection = () => {
  const connection = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  });

  connection.on('connect', () => {
    logger.info('BullMQ Redis connection established');
  });

  connection.on('error', (err) => {
    logger.error({ err }, 'BullMQ Redis connection error');
  });

  connection.on('close', () => {
    logger.info('BullMQ Redis connection closed');
  });

  connection.on('reconnecting', () => {
    logger.info('BullMQ Redis reconnecting...');
  });

  return connection;
};

