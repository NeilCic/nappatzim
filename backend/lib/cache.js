import redis from './redisCache.js';
import logger from './logger.js';

const DEFAULT_TTL = 300;

export async function getCache(key) {
  try {
    const value = await redis.get(key);
    if (value) {
      logger.debug({ key }, 'Cache hit');
      return JSON.parse(value);
    }
    logger.debug({ key }, 'Cache miss');
    return null;
  } catch (error) {
    logger.error({ error, key }, 'Cache get error');
    return null; // Fail silently - cache is optional
  }
}

export async function setCache(key, value, ttl = DEFAULT_TTL) {
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttl);
    logger.debug({ key, ttl }, 'Cache set');
  } catch (error) {
    logger.error({ error, key }, 'Cache set error');
    // Fail silently - cache is optional
  }
}

export async function invalidateCache(keyOrPattern) {
  try {
    if (keyOrPattern.includes('*')) {
      // Pattern-based deletion
      const keys = await redis.keys(keyOrPattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.debug({ pattern: keyOrPattern, count: keys.length }, 'Cache invalidated (pattern)');
      }
    } else {
      // Single key deletion
      await redis.del(keyOrPattern);
      logger.debug({ key: keyOrPattern }, 'Cache invalidated');
    }
  } catch (error) {
    logger.error({ error, keyOrPattern }, 'Cache invalidate error');
  }
}

 // cache key generators for consistent naming
export const cacheKeys = {
  userCategories: (userId) => `categories:${userId}`,
  categoryProgress: (userId, categoryId) => `progress:${userId}:${categoryId}`,
  workoutProgress: (userId, workoutId) => `workout-progress:${userId}:${workoutId}`,
  userProgressPattern: (userId) => `progress:${userId}:*`,
};

