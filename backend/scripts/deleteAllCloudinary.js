/**
 * Script to delete ALL resources from Cloudinary
 * This will delete resources based on the current environment:
 * - Development (NODE_ENV !== 'production'): deletes from 'nappatzim/dev'
 * - Production (NODE_ENV === 'production'): deletes from 'nappatzim'
 * 
 * Usage: node backend/scripts/deleteAllCloudinary.js
 * 
 * WARNING: This is destructive and cannot be undone!
 */

import { v2 as cloudinary } from 'cloudinary';
import { getCloudinaryFolderPrefix } from '../services/cloudinaryService.js';
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

// Configure Cloudinary
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
  console.error('❌ Missing Cloudinary environment variables!');
  console.error('   Required: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
  console.error(`   CLOUDINARY_CLOUD_NAME: ${cloudName ? '✓' : '✗'}`);
  console.error(`   CLOUDINARY_API_KEY: ${apiKey ? '✓' : '✗'}`);
  console.error(`   CLOUDINARY_API_SECRET: ${apiSecret ? '✓' : '✗'}`);
  process.exit(1);
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
});

async function deleteAllResources() {
  try {
    const folderPrefix = getCloudinaryFolderPrefix();
    const isProduction = process.env.NODE_ENV === 'production';
    
    console.log('⚠️  WARNING: This will delete ALL resources from Cloudinary!');
    console.log(`   Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    console.log(`   Folder prefix: ${folderPrefix}`);
    console.log(`   This will delete resources under "${folderPrefix}" folder only\n`);

    // Delete everything under the environment-specific folder prefix
    console.log(`Deleting all resources under "${folderPrefix}" folder...`);
    
    let totalDeleted = 0;
    
    // Delete images
    console.log('   Deleting images...');
    try {
      const imageResult = await cloudinary.api.delete_resources_by_prefix(folderPrefix, {
        resource_type: 'image',
        invalidate: true,
      });
      const imageCount = imageResult.deleted ? Object.keys(imageResult.deleted).length : 0;
      totalDeleted += imageCount;
      console.log(`   ✓ Deleted ${imageCount} images`);
    } catch (error) {
      console.log(`   ⚠️  Error deleting images: ${error.message}`);
    }
    
    // Delete videos
    console.log('   Deleting videos...');
    try {
      const videoResult = await cloudinary.api.delete_resources_by_prefix(folderPrefix, {
        resource_type: 'video',
        invalidate: true,
      });
      const videoCount = videoResult.deleted ? Object.keys(videoResult.deleted).length : 0;
      totalDeleted += videoCount;
      console.log(`   ✓ Deleted ${videoCount} videos`);
    } catch (error) {
      console.log(`   ⚠️  Error deleting videos: ${error.message}`);
    }

    console.log(`\n✅ Deletion complete! Total deleted: ${totalDeleted} resources`);

    // Also check for any remaining resources using search API
    console.log('\nChecking for any remaining resources...');
    try {
      const searchResult = await cloudinary.search
        .expression(`folder:${folderPrefix}*`)
        .execute();

      if (searchResult.resources && searchResult.resources.length > 0) {
        console.log(`   Found ${searchResult.resources.length} remaining resources, deleting...`);
        
        // Group by resource type
        const images = searchResult.resources.filter(r => r.resource_type === 'image').map(r => r.public_id);
        const videos = searchResult.resources.filter(r => r.resource_type === 'video').map(r => r.public_id);
        
        if (images.length > 0) {
          const imgResult = await cloudinary.api.delete_resources(images, {
            resource_type: 'image',
            invalidate: true,
          });
          const imgCount = imgResult.deleted ? Object.keys(imgResult.deleted).length : 0;
          totalDeleted += imgCount;
          console.log(`   ✓ Deleted ${imgCount} additional images`);
        }
        
        if (videos.length > 0) {
          const vidResult = await cloudinary.api.delete_resources(videos, {
            resource_type: 'video',
            invalidate: true,
          });
          const vidCount = vidResult.deleted ? Object.keys(vidResult.deleted).length : 0;
          totalDeleted += vidCount;
          console.log(`   ✓ Deleted ${vidCount} additional videos`);
        }
      } else {
        console.log('   No remaining resources found.');
      }
    } catch (error) {
      console.log(`   ⚠️  Error checking remaining resources: ${error.message}`);
    }

    console.log('\n✅ All Cloudinary resources have been deleted!');
  } catch (error) {
    console.error('❌ Error deleting resources:', error);
    throw error;
  }
}

// Run the script
deleteAllResources()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error.message);
    process.exit(1);
  });

