/**
 * Script to regenerate video thumbnails for all existing videos
 * This updates the thumbnailUrl in the database with the correct Cloudinary transformation
 * 
 * Usage: node backend/scripts/regenerateVideoThumbnails.js
 */

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
  console.error('❌ No .env file found in backend/ or root directory');
  process.exit(1);
}

// Import after env is loaded
import prisma from '../lib/prisma.js';
import { getVideoThumbnail } from '../services/cloudinaryService.js';

async function regenerateThumbnails() {
  try {
    console.log('🔄 Fetching all videos from database...\n');

    const videos = await prisma.spotVideo.findMany({
      select: {
        id: true,
        title: true,
        videoPublicId: true,
        thumbnailUrl: true,
      },
    });

    if (videos.length === 0) {
      console.log('ℹ️  No videos found in database.');
      return;
    }

    console.log(`📹 Found ${videos.length} video(s) to process\n`);

    let updated = 0;
    let errors = 0;

    for (const video of videos) {
      try {
        if (!video.videoPublicId) {
          console.warn(`⚠️  Video ${video.id} (${video.title || 'Untitled'}) has no videoPublicId, skipping...`);
          errors++;
          continue;
        }

        const newThumbnailUrl = getVideoThumbnail(video.videoPublicId);
        
        // Only update if the URL is different
        if (newThumbnailUrl !== video.thumbnailUrl) {
          await prisma.spotVideo.update({
            where: { id: video.id },
            data: { thumbnailUrl: newThumbnailUrl },
          });
          
          console.log(`✅ Updated thumbnail for: ${video.title || 'Untitled'} (${video.id})`);
          console.log(`   Old: ${video.thumbnailUrl || 'null'}`);
          console.log(`   New: ${newThumbnailUrl}\n`);
          updated++;
        } else {
          console.log(`ℹ️  Thumbnail URL unchanged for: ${video.title || 'Untitled'} (${video.id})\n`);
        }
      } catch (error) {
        console.error(`❌ Error processing video ${video.id} (${video.title || 'Untitled'}):`, error.message);
        errors++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ⚠️  Errors: ${errors}`);
    console.log(`   📹 Total: ${videos.length}`);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

regenerateThumbnails();

