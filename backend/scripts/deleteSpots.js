/**
 * Script to delete spots from the database
 * Can delete all spots or spots by name (exact or partial match)
 * 
 * Usage:
 *   Delete all spots: node backend/scripts/deleteSpots.js --all
 *   Delete by exact name: node backend/scripts/deleteSpots.js --name "Spot Name" --name "Spot Name 2"
 *   Delete by partial name: node backend/scripts/deleteSpots.js --name "Spot" --partial
 * 
 * WARNING: This will also delete associated videos from Cloudinary and the database!
 */

import prisma from '../lib/prisma.js';
import { deleteMultipleFromCloudinary } from '../services/cloudinaryService.js';
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

async function deleteSpot(spot) {
  let videosDeleted = 0;
  let cloudinaryErrors = 0;

  if (spot.videos && spot.videos.length > 0) {
    const publicIdsToDelete = spot.videos
      .map((video) => video.videoPublicId)
      .filter((id) => id); // Filter out null/undefined

    if (publicIdsToDelete.length > 0) {
      const deleteResults = await deleteMultipleFromCloudinary(publicIdsToDelete);
      
      // Count successes and errors
      deleteResults.forEach((result) => {
        if (result.error) {
          cloudinaryErrors++;
          console.warn(`   ⚠️  Failed to delete video from Cloudinary: ${result.error}`);
        } else {
          videosDeleted++;
        }
      });
    }
  }

  // Delete the spot from database (videos will be cascade deleted)
  await prisma.spot.delete({
    where: { id: spot.id },
  });

  return { videosDeleted, cloudinaryErrors };
}

async function deleteSpots() {
  try {
    const args = process.argv.slice(2);
    const deleteAll = args.includes('--all');
    const partialMatch = args.includes('--partial');

    // Collect all --name arguments
    const spotNames = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--name' && args[i + 1]) {
        spotNames.push(args[i + 1]);
        i++; // Skip the next argument as we've already processed it
      }
    }

    if (!deleteAll && spotNames.length === 0) {
      console.error('❌ Error: Must specify either --all or at least one --name "Spot Name"');
      console.error('\nUsage:');
      console.error('  Delete all spots: node backend/scripts/deleteSpots.js --all');
      console.error('  Delete by exact name: node backend/scripts/deleteSpots.js --name "Spot Name"');
      console.error('  Delete multiple by exact name: node backend/scripts/deleteSpots.js --name "Spot 1" --name "Spot 2" --name "Spot 3"');
      console.error('  Delete by partial name: node backend/scripts/deleteSpots.js --name "Spot" --partial');
      process.exit(1);
    }

    let spots = [];
    let queryDescription = '';

    if (deleteAll) {
      console.log('⚠️  WARNING: This will delete ALL spots from the database!');
      console.log('   This will also delete all associated videos from Cloudinary and the database.\n');
      
      spots = await prisma.spot.findMany({
        include: {
          videos: true,
          layout: {
            select: {
              name: true,
            },
          },
          user: {
            select: {
              email: true,
              username: true,
            },
          },
        },
      });
      queryDescription = 'all spots';
    } else {
      // Build OR condition for multiple names
      const whereClause = partialMatch
        ? {
            OR: spotNames.map(name => ({
              name: { contains: name, mode: 'insensitive' },
            })),
          }
        : {
            OR: spotNames.map(name => ({ name })),
          };

      spots = await prisma.spot.findMany({
        where: whereClause,
        include: {
          videos: true,
          layout: {
            select: {
              name: true,
            },
          },
          user: {
            select: {
              email: true,
              username: true,
            },
          },
        },
      });

      if (spotNames.length === 1) {
        queryDescription = partialMatch
          ? `spots with name containing "${spotNames[0]}"`
          : `spots with exact name "${spotNames[0]}"`;
      } else {
        queryDescription = partialMatch
          ? `spots with name containing any of: ${spotNames.map(n => `"${n}"`).join(', ')}`
          : `spots with exact name matching any of: ${spotNames.map(n => `"${n}"`).join(', ')}`;
      }
    }

    if (spots.length === 0) {
      console.log(`\n✅ No spots found matching: ${queryDescription}`);
      return;
    }

    console.log(`\n📋 Found ${spots.length} spot(s) to delete:`);
    spots.forEach((spot, index) => {
      console.log(`   ${index + 1}. "${spot.name}" (ID: ${spot.id})`);
      console.log(`      Layout: ${spot.layout.name}`);
      console.log(`      User: ${spot.user.email || spot.user.username || 'Unknown'}`);
      console.log(`      Videos: ${spot.videos.length}`);
    });

    console.log(`\n⚠️  About to delete ${spots.length} spot(s) and their associated videos...`);
    console.log('   This action cannot be undone!\n');

    let totalDeleted = 0;
    let totalVideosDeleted = 0;
    let totalCloudinaryErrors = 0;

    for (const spot of spots) {
      try {
        console.log(`Deleting spot "${spot.name}" (${spot.id})...`);
        const result = await deleteSpot(spot);
        totalDeleted++;
        totalVideosDeleted += result.videosDeleted;
        totalCloudinaryErrors += result.cloudinaryErrors;
        console.log(`   ✓ Deleted spot and ${result.videosDeleted} video(s) from Cloudinary`);
        if (result.cloudinaryErrors > 0) {
          console.log(`   ⚠️  ${result.cloudinaryErrors} video(s) failed to delete from Cloudinary`);
        }
      } catch (error) {
        console.error(`   ❌ Error deleting spot ${spot.id}: ${error.message}`);
      }
    }

    console.log(`\n✅ Deletion complete!`);
    console.log(`   Spots deleted: ${totalDeleted}`);
    console.log(`   Videos deleted from Cloudinary: ${totalVideosDeleted}`);
    if (totalCloudinaryErrors > 0) {
      console.log(`   ⚠️  Cloudinary errors: ${totalCloudinaryErrors}`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
deleteSpots()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error.message);
    process.exit(1);
  });

