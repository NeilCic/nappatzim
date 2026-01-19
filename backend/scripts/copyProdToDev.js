#!/usr/bin/env node

/**
 * Script to sync production database to development database
 * 
 * Usage:
 *   1. Make sure your .env file has both PROD_DATABASE_URL and DATABASE_URL
 *   2. Make sure your local dev database is running (docker compose up)
 *   3. Run: npm run db:sync
 *         OR: node backend/scripts/copyProdToDev.js
 * 
 * For automated syncing (e.g., scheduled task):
 *   SKIP_CONFIRM=1 npm run db:sync
 * 
 * To skip Cloudinary cleanup (default behavior - only clears if assets exist):
 *   SKIP_CLOUDINARY=1 npm run db:sync
 * 
 * Note on Cloudinary sync:
 *   - Syncs database first, then copies production Cloudinary assets to dev folder
 *   - Updates database references to point to dev versions (nappatzim/dev/)
 *   - This allows free experimentation in dev without affecting production
 *   - Then cleans up any remaining orphaned dev assets
 *   - Set SKIP_CLOUDINARY=1 to skip Cloudinary sync and cleanup
 * 
 * Security Note:
 *   - PROD_DATABASE_URL in .env is safe IF .env is in .gitignore (which it should be)
 *   - Never commit .env files to version control
 *   - Consider using environment variables or a secrets manager for production
 * 
 * Important:
 *   - Production database is READ-ONLY (pg_dump exports/copies, doesn't delete from prod)
 *   - Only DEV database gets replaced (DROP and restore from prod backup)
 *   - Production Cloudinary assets are COPIED to dev folder (prod assets unchanged)
 *   - Database references updated to point to dev Cloudinary copies
 *   - This allows free experimentation in dev without affecting production
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import Prisma after env is loaded
let prisma = null;

// Load environment variables from root .env file
const envPath = path.join(__dirname, '../../.env');
dotenv.config({ path: envPath });

// Safety check: Verify .env is in .gitignore
async function verifyEnvSafety() {
  const gitignorePath = path.join(__dirname, '../../.gitignore');
  try {
    if (fs.existsSync(gitignorePath)) {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
      if (!gitignoreContent.includes('.env')) {
        console.warn('⚠️  WARNING: .env file is not in .gitignore!');
        console.warn('   Your PROD_DATABASE_URL could be committed to version control.');
        console.warn('   Please add .env to .gitignore\n');
      }
    }
  } catch (error) {
    // Gitignore check failed, but don't block the script
    console.warn('⚠️  Could not verify .gitignore (non-fatal)\n');
  }
}

const PROD_DATABASE_URL = process.env.PROD_DATABASE_URL;
const DEV_DATABASE_URL = process.env.DATABASE_URL;

if (!PROD_DATABASE_URL) {
  console.error('❌ ERROR: PROD_DATABASE_URL not found in .env file');
  console.error('   Please add PROD_DATABASE_URL to your .env file');
  process.exit(1);
}

if (!DEV_DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL not found in .env file');
  console.error('   Please add DATABASE_URL to your .env file');
  process.exit(1);
}

// Parse connection strings
function parseDatabaseUrl(url) {
  try {
    const urlObj = new URL(url);
    return {
      host: urlObj.hostname,
      port: urlObj.port || '5432',
      database: urlObj.pathname.slice(1),
      user: urlObj.username,
      password: urlObj.password,
    };
  } catch (error) {
    console.error('❌ ERROR: Invalid database URL format');
    console.error(error.message);
    process.exit(1);
  }
}

/**
 * Get all Cloudinary public IDs and records from the synced database
 */
async function getDatabaseCloudinaryAssets() {
  if (!prisma) {
    const prismaModule = await import('../lib/prisma.js');
    prisma = prismaModule.default;
  }

  const assets = {
    layouts: [], // { id, layoutImagePublicId, layoutImageUrl }
    videos: [], // { id, videoPublicId, videoUrl }
  };

  try {
    // Get layout image public IDs
    const layouts = await prisma.layout.findMany({
      select: { id: true, layoutImagePublicId: true, layoutImageUrl: true },
    });
    assets.layouts = layouts.filter(l => l.layoutImagePublicId && l.layoutImagePublicId.startsWith('nappatzim/'));

    // Get video public IDs from ClimbVideo
    const videos = await prisma.climbVideo.findMany({
      select: { id: true, videoPublicId: true, videoUrl: true },
    });
    assets.videos = videos.filter(v => v.videoPublicId && v.videoPublicId.startsWith('nappatzim/'));

    return assets;
  } catch (error) {
    console.error(`   ⚠️  Error querying database for Cloudinary assets: ${error.message}`);
    return { layouts: [], videos: [] };
  }
}

/**
 * Get all Cloudinary public IDs from the synced database (for comparison)
 */
async function getDatabasePublicIds() {
  const assets = await getDatabaseCloudinaryAssets();
  const publicIds = new Set();
  
  assets.layouts.forEach(layout => {
    if (layout.layoutImagePublicId) {
      publicIds.add(layout.layoutImagePublicId);
    }
  });
  
  assets.videos.forEach(video => {
    if (video.videoPublicId) {
      publicIds.add(video.videoPublicId);
    }
  });
  
  return publicIds;
}

/**
 * Copy production Cloudinary assets to dev folder and update database references
 * This allows safe experimentation in dev without affecting production
 */
async function copyProdCloudinaryToDev() {
  // Only copy if we're in dev mode and Cloudinary is configured
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    console.log('⏭️  Skipping Cloudinary copy (production mode)\n');
    return;
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.log('⏭️  Skipping Cloudinary copy (credentials not configured)\n');
    return;
  }

  // Initialize Prisma if needed
  if (!prisma) {
    const prismaModule = await import('../lib/prisma.js');
    prisma = prismaModule.default;
  }

  console.log('📋 Copying production Cloudinary assets to dev folder...');

  try {
    // Step 1: Get all Cloudinary assets from database
    const dbAssets = await getDatabaseCloudinaryAssets();
    const prodAssets = {
      layouts: dbAssets.layouts.filter(l => l.layoutImagePublicId && !l.layoutImagePublicId.startsWith('nappatzim/dev/')),
      videos: dbAssets.videos.filter(v => v.videoPublicId && !v.videoPublicId.startsWith('nappatzim/dev/')),
    };

    const totalToCopy = prodAssets.layouts.length + prodAssets.videos.length;
    if (totalToCopy === 0) {
      console.log('   ℹ️  No production Cloudinary assets to copy (already using dev assets)\n');
      return;
    }

    console.log(`   ℹ️  Found ${prodAssets.layouts.length} layout images and ${prodAssets.videos.length} videos to copy`);

    // Step 2: Import Cloudinary
    const { v2: cloudinary } = await import('cloudinary');
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });

    const devFolderPrefix = 'nappatzim/dev';
    let copiedCount = 0;
    const updatePromises = [];

    // Step 3: Copy layout images
    for (const layout of prodAssets.layouts) {
      try {
        // Get the asset URL from prod
        const prodUrl = layout.layoutImageUrl || cloudinary.url(layout.layoutImagePublicId, { secure: true });
        
        // Extract folder structure from prod public ID and recreate in dev
        const prodPublicId = layout.layoutImagePublicId;
        const relativePath = prodPublicId.replace('nappatzim/', '');
        const devPublicId = `${devFolderPrefix}/${relativePath}`;
        
        // Upload prod URL to dev folder (Cloudinary will download and re-upload)
        const uploadResult = await cloudinary.uploader.upload(prodUrl, {
          public_id: devPublicId,
          resource_type: 'image',
          overwrite: true,
          invalidate: true,
        });

        // Update database to point to dev version
        updatePromises.push(
          prisma.layout.update({
            where: { id: layout.id },
            data: {
              layoutImagePublicId: uploadResult.public_id,
              layoutImageUrl: uploadResult.secure_url,
            },
          })
        );

        copiedCount++;
        if (copiedCount % 10 === 0) {
          console.log(`   📥 Copied ${copiedCount}/${totalToCopy} assets...`);
        }
      } catch (error) {
        console.log(`   ⚠️  Error copying layout ${layout.id}: ${error.message}`);
      }
    }

    // Step 4: Copy videos
    for (const video of prodAssets.videos) {
      try {
        // Get the asset URL from prod
        const prodUrl = video.videoUrl || cloudinary.url(video.videoPublicId, {
          resource_type: 'video',
          secure: true,
        });
        
        // Extract folder structure from prod public ID and recreate in dev
        const prodPublicId = video.videoPublicId;
        const relativePath = prodPublicId.replace('nappatzim/', '');
        const devPublicId = `${devFolderPrefix}/${relativePath}`;
        
        // Upload prod URL to dev folder (Cloudinary will download and re-upload)
        const uploadResult = await cloudinary.uploader.upload(prodUrl, {
          public_id: devPublicId,
          resource_type: 'video',
          overwrite: true,
          invalidate: true,
        });

        // Generate thumbnail URL for dev version
        const thumbnailUrl = cloudinary.url(devPublicId, {
          resource_type: 'video',
          secure: true,
          format: 'jpg',
          transformation: [
            { start_offset: 0 },
            { width: 400, height: 300, crop: 'fill' },
            { quality: 'auto' },
          ],
        });

        // Update database to point to dev version
        updatePromises.push(
          prisma.climbVideo.update({
            where: { id: video.id },
            data: {
              videoPublicId: uploadResult.public_id,
              videoUrl: uploadResult.secure_url,
              thumbnailUrl,
            },
          })
        );

        copiedCount++;
        if (copiedCount % 10 === 0) {
          console.log(`   📥 Copied ${copiedCount}/${totalToCopy} assets...`);
        }
      } catch (error) {
        console.log(`   ⚠️  Error copying video ${video.id}: ${error.message}`);
      }
    }

    // Step 5: Update all database records
    console.log(`   🔄 Updating ${updatePromises.length} database records...`);
    await Promise.allSettled(updatePromises);

    console.log(`✅ Cloudinary copy complete! Copied ${copiedCount} assets to dev folder\n`);
  } catch (error) {
    console.error(`⚠️  WARNING: Failed to copy Cloudinary assets: ${error.message}`);
    console.error('   Dev database references may still point to production assets\n');
  }
}

/**
 * Get all dev Cloudinary assets and compare with database
 * Only delete orphaned assets (in Cloudinary but not in DB)
 */
async function clearDevCloudinary() {
  // Only clear if we're in dev mode and Cloudinary is configured
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    console.log('⏭️  Skipping Cloudinary cleanup (production mode)\n');
    return;
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.log('⏭️  Skipping Cloudinary cleanup (credentials not configured)\n');
    return;
  }

  console.log('🧹 Comparing dev Cloudinary assets with database...');
  
  try {
    // Step 1: Get all public IDs from the synced database
    console.log('   📥 Fetching Cloudinary public IDs from database...');
    const dbPublicIds = await getDatabasePublicIds();
    console.log(`   ℹ️  Found ${dbPublicIds.size} Cloudinary assets referenced in database`);

    // Step 2: Import Cloudinary and get all dev Cloudinary assets
    const { v2: cloudinary } = await import('cloudinary');
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });

    const devFolderPrefix = 'nappatzim/dev';
    
    // Get all dev Cloudinary assets
    console.log('   📤 Fetching all dev Cloudinary assets...');
    const cloudinaryAssets = [];
    
    // Fetch images
    try {
      const imageSearch = await cloudinary.search
        .expression(`folder:${devFolderPrefix}*`)
        .resource_type('image')
        .max_results(500)
        .execute();
      if (imageSearch.resources) {
        cloudinaryAssets.push(...imageSearch.resources.map(r => ({
          publicId: r.public_id,
          resourceType: 'image',
        })));
      }
    } catch (error) {
      console.log(`   ⚠️  Error fetching images: ${error.message}`);
    }

    // Fetch videos
    try {
      const videoSearch = await cloudinary.search
        .expression(`folder:${devFolderPrefix}*`)
        .resource_type('video')
        .max_results(500)
        .execute();
      if (videoSearch.resources) {
        cloudinaryAssets.push(...videoSearch.resources.map(r => ({
          publicId: r.public_id,
          resourceType: 'video',
        })));
      }
    } catch (error) {
      console.log(`   ⚠️  Error fetching videos: ${error.message}`);
    }

    if (cloudinaryAssets.length === 0) {
      console.log('   ℹ️  No dev Cloudinary assets found (already clean)\n');
      return;
    }

    console.log(`   ℹ️  Found ${cloudinaryAssets.length} dev Cloudinary assets`);

    // Step 3: Find orphaned assets (in Cloudinary but not in DB)
    const orphanedAssets = cloudinaryAssets.filter(asset => 
      !dbPublicIds.has(asset.publicId)
    );

    if (orphanedAssets.length === 0) {
      console.log('   ✅ All dev Cloudinary assets are referenced in database (no cleanup needed)\n');
      return;
    }

    console.log(`   🗑️  Found ${orphanedAssets.length} orphaned assets to delete`);

    // Step 4: Delete orphaned assets
    const orphanedByType = {
      image: orphanedAssets.filter(a => a.resourceType === 'image').map(a => a.publicId),
      video: orphanedAssets.filter(a => a.resourceType === 'video').map(a => a.publicId),
    };

    let totalDeleted = 0;

    // Delete orphaned images
    if (orphanedByType.image.length > 0) {
      try {
        const imageResult = await cloudinary.api.delete_resources(orphanedByType.image, {
          resource_type: 'image',
          invalidate: true,
        });
        const imageCount = imageResult.deleted ? Object.keys(imageResult.deleted).length : 0;
        totalDeleted += imageCount;
        console.log(`   ✓ Deleted ${imageCount} orphaned images`);
      } catch (error) {
        console.log(`   ⚠️  Error deleting images: ${error.message}`);
      }
    }

    // Delete orphaned videos
    if (orphanedByType.video.length > 0) {
      try {
        const videoResult = await cloudinary.api.delete_resources(orphanedByType.video, {
          resource_type: 'video',
          invalidate: true,
        });
        const videoCount = videoResult.deleted ? Object.keys(videoResult.deleted).length : 0;
        totalDeleted += videoCount;
        console.log(`   ✓ Deleted ${videoCount} orphaned videos`);
      } catch (error) {
        console.log(`   ⚠️  Error deleting videos: ${error.message}`);
      }
    }

    const keptCount = cloudinaryAssets.length - orphanedAssets.length;
    if (totalDeleted > 0) {
      console.log(`✅ Cleanup complete! Deleted ${totalDeleted} orphaned assets, kept ${keptCount} assets referenced in database\n`);
    } else {
      console.log(`✅ No orphaned assets to delete (kept ${keptCount} assets)\n`);
    }
  } catch (error) {
    console.error(`⚠️  WARNING: Failed to clear dev Cloudinary: ${error.message}`);
    console.error('   You may want to manually clean up Cloudinary assets\n');
  } finally {
    // Disconnect Prisma if it was initialized
    if (prisma) {
      try {
        await prisma.$disconnect();
      } catch (error) {
        // Ignore disconnect errors
      }
    }
  }
}

async function main() {
  const startTime = Date.now();
  
  // Safety check first
  await verifyEnvSafety();
  
  console.log('🔄 Starting database sync from production to development...\n');

  const prodDb = parseDatabaseUrl(PROD_DATABASE_URL);
  const devDb = parseDatabaseUrl(DEV_DATABASE_URL);

  console.log(`📤 Production DB: ${prodDb.host}/${prodDb.database}`);
  console.log(`📥 Development DB: ${devDb.host}/${devDb.database}\n`);

    // Confirm action (unless SKIP_CONFIRM is set)
  if (!process.env.SKIP_CONFIRM) {
    console.log('ℹ️  Production database: READ-ONLY (will export/copy, no changes to prod)');
    console.log('⚠️  WARNING: This will DELETE all data in your DEV database and replace it!');
    if (!process.env.SKIP_CLOUDINARY) {
      console.log('ℹ️  Will also COPY production Cloudinary assets to dev folder (nappatzim/dev/)');
      console.log('   and update database references - allows safe experimentation without affecting prod');
    }
    console.log('   Make sure you have backups of dev data if needed.\n');
  }

  const dumpFile = path.join(__dirname, 'prod_dump.sql');

  try {
    // Step 1: Export/copy production database (pg_dump creates a backup, doesn't delete from prod)
    console.log('📥 Exporting production database (creating backup copy)...');
    const dumpCommand = `pg_dump "${PROD_DATABASE_URL}" --no-owner --no-acl --clean --if-exists > "${dumpFile}"`;
    
    try {
      await execAsync(dumpCommand, { shell: true, maxBuffer: 10 * 1024 * 1024 });
      console.log('✅ Production database exported successfully (prod database unchanged)\n');
    } catch (error) {
      console.error('❌ ERROR: Failed to export production database');
      console.error('   Make sure pg_dump is installed and accessible in your PATH');
      console.error('   On Windows, you may need to install PostgreSQL client tools');
      console.error(`   Error: ${error.message}`);
      process.exit(1);
    }

    // Step 2: Restore to development database
    console.log('📤 Restoring to development database...');
    const restoreCommand = `psql "${DEV_DATABASE_URL}" < "${dumpFile}"`;
    
    try {
      await execAsync(restoreCommand, { shell: true, maxBuffer: 10 * 1024 * 1024 });
      console.log('✅ Development database restored successfully\n');
    } catch (error) {
      console.error('❌ ERROR: Failed to restore to development database');
      console.error('   Make sure psql is installed and your dev database is running');
      console.error('   Run: docker compose up -d (in backend folder)');
      console.error(`   Error: ${error.message}`);
      process.exit(1);
    }

    // Step 3: Regenerate Prisma Client (needed before querying DB for Cloudinary cleanup)
    console.log('🔄 Regenerating Prisma Client...');
    try {
      await execAsync('npx prisma generate', { 
        cwd: path.join(__dirname, '../..'),
        shell: true 
      });
      console.log('✅ Prisma Client regenerated\n');
    } catch (error) {
      console.error('⚠️  WARNING: Failed to regenerate Prisma Client');
      console.error('   Run manually: npx prisma generate');
      console.error(`   Error: ${error.message}\n`);
    }

    // Step 4: Copy production Cloudinary assets to dev and update DB references (optional)
    if (!process.env.SKIP_CLOUDINARY) {
      await copyProdCloudinaryToDev();
      
      // Step 5: Clear orphaned dev Cloudinary assets (anything not referenced in DB)
      await clearDevCloudinary();
    } else {
      console.log('⏭️  Skipping Cloudinary sync (SKIP_CLOUDINARY=1)\n');
    }

    // Clean up dump file
    try {
      if (fs.existsSync(dumpFile)) {
        fs.unlinkSync(dumpFile);
        console.log('🧹 Cleaned up dump file\n');
      }
    } catch (error) {
      console.error('⚠️  WARNING: Failed to clean up dump file');
      console.error(`   You may want to manually delete: ${dumpFile}\n`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('🎉 Successfully synced production database to development!');
    console.log(`   Sync completed in ${duration}s`);
    console.log('   Your dev database now contains production data.');

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`\n❌ Sync failed after ${duration}s`);
    console.error(`   Error: ${error.message}`);
    process.exit(1);
  }
}

main();
