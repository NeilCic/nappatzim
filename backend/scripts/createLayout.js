/**
 * Admin script to manually create a gym layout
 * Usage: node backend/scripts/createLayout.js <layout-name> <image-path>
 * Example: node backend/scripts/createLayout.js "Main Gym" "../mobile/assets/gym-layout.jpg"
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
  dotenv.config();
}

import { uploadToCloudinary, deleteFromCloudinary, getCloudinaryFolderPrefix } from '../services/cloudinaryService.js';
import prisma from '../lib/prisma.js';
import { readFileSync } from 'fs';

async function createLayout(name, imagePath) {
  try {
    console.log(`Creating layout: "${name}"`);
    console.log(`Image path: ${imagePath}`);

    // Resolve the image path (can be relative or absolute)
    const resolvedPath = resolve(__dirname, imagePath);
    console.log(`Resolved path: ${resolvedPath}`);

    // Read the image file
    const imageBuffer = readFileSync(resolvedPath);
    console.log(`Image file read successfully (${imageBuffer.length} bytes)`);

    // Upload to Cloudinary
    console.log('Uploading to Cloudinary...');
    const uploadResult = await uploadToCloudinary(
      imageBuffer,
      `${getCloudinaryFolderPrefix()}/layouts`,
      {
        resource_type: 'image',
      }
    );
    console.log('✓ Uploaded to Cloudinary');
    console.log(`  URL: ${uploadResult.url}`);
    console.log(`  Public ID: ${uploadResult.publicId}`);

    // Create database entry
    console.log('Creating database entry...');
    let layout;
    try {
      layout = await prisma.layout.create({
        data: {
          name,
          layoutImageUrl: uploadResult.url,
          layoutImagePublicId: uploadResult.publicId,
        },
      });
      console.log('✓ Layout created in database');
      console.log(`  ID: ${layout.id}`);
      console.log(`  Name: ${layout.name}`);
      console.log(`  Created at: ${layout.createdAt}`);
    } catch (dbError) {
      // Rollback: Delete from Cloudinary if database save fails
      console.error('\n❌ Database save failed, rolling back Cloudinary upload...');
      try {
        await deleteFromCloudinary(uploadResult.publicId);
        console.log('✓ Rolled back Cloudinary upload');
      } catch (cleanupError) {
        console.error('⚠️  Failed to rollback Cloudinary upload - image may be orphaned:', cleanupError.message);
      }
      throw dbError;
    }

    console.log('\n✅ Layout created successfully!');
    return layout;
  } catch (error) {
    console.error('\n❌ Error creating layout:', error.message);
    if (error.code === 'ENOENT') {
      console.error('  → File not found. Check the image path.');
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Get command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Usage: node backend/scripts/createLayout.js <layout-name> <image-path>');
  console.error('Example: node backend/scripts/createLayout.js "Main Gym" "../mobile/assets/gym-layout.jpg"');
  process.exit(1);
}

const [layoutName, imagePath] = args;

createLayout(layoutName, imagePath)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

