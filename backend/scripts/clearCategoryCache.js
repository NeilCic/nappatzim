/**
 * Script to clear category cache for a user
 * 
 * Usage: node backend/scripts/clearCategoryCache.js
 */

// Load environment variables FIRST, before any imports that use them
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try to load .env from backend folder first, then root
const backendEnv = resolve(__dirname, '../.env');
const rootEnv = resolve(__dirname, '../../.env');

if (existsSync(backendEnv)) {
  dotenv.config({ path: backendEnv });
} else if (existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
} else {
  dotenv.config(); // Try default location
}

// Now that env vars are loaded, import modules that depend on them
import { invalidateCache, cacheKeys } from '../lib/cache.js';
import prisma from '../lib/prisma.js';

async function clearCategoryCache() {
  try {
    console.log('🔄 Clearing category cache...\n');

    // Get the user (Neil)
    const user = await prisma.user.findFirst({
      where: { email: { contains: 'neil', mode: 'insensitive' } }
    });

    if (!user) {
      console.error('❌ User not found!');
      process.exit(1);
    }

    console.log(`👤 Found user: ${user.email} (${user.username || 'no username'})\n`);

    // Clear the category cache
    const cacheKey = cacheKeys.userCategories(user.id);
    await invalidateCache(cacheKey);

    console.log(`✅ Category cache cleared for user: ${user.email}`);
    console.log(`   Cache key: ${cacheKey}\n`);

  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
clearCategoryCache()
  .then(() => {
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error.message);
    process.exit(1);
  });

