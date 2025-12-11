import Redis from 'ioredis';
import logger from './logger.js';

// Use default for local development (Docker), but make it optional in production
const REDIS_URL = process.env.REDIS_URL || (process.env.NODE_ENV === 'production' ? null : 'redis://localhost:6379');

const createRedisInstance = () => {
  if (!REDIS_URL) {
    logger.info('Redis not configured - running without cache');
    return null;
  }

  const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    lazyConnect: true,
    // Suppress connection errors after initial attempts
    retryStrategy: (times) => {
      if (times > 3) {
        logger.warn('Redis connection failed after 3 attempts - running without cache');
        return null; // Stop retrying
      }
      return Math.min(times * 50, 2000);
    },
  });

  redis.on('connect', () => {
    logger.info('Redis connected');
  });

  redis.on('error', (err) => {
    // Only log first few errors to avoid spam
    if (!redis._errorLogged) {
      logger.warn({ err: err.message }, 'Redis connection error - running without cache');
      redis._errorLogged = true;
    }
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    if (redis) await redis.quit();
  });

  return redis;
};

const redis = createRedisInstance();

export default redis;

