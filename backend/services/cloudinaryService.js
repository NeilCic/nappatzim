import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync } from 'fs';

// Try to load .env from backend folder first, then root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const backendEnv = resolve(__dirname, '../.env');
const rootEnv = resolve(__dirname, '../../.env');

if (existsSync(backendEnv)) {
  dotenv.config({ path: backendEnv });
} else if (existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
} else {
  // Fallback to default dotenv.config() which looks in current working directory
  dotenv.config();
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Get the Cloudinary folder prefix based on environment
 * Development uses 'nappatzim/dev', production uses 'nappatzim'
 * @returns {string} Folder prefix
 */
export function getCloudinaryFolderPrefix() {
  return process.env.NODE_ENV === 'production' ? 'nappatzim' : 'nappatzim/dev';
}

/**
 * Upload a file to Cloudinary
 * @param {Buffer|string} file - File buffer or file path
 * @param {string} folder - Optional folder path in Cloudinary
 * @param {Object} options - Additional Cloudinary options
 * @returns {Promise<Object>} Upload result with URL
 */
export async function uploadToCloudinary(file, folder = 'nappatzim', options = {}) {
  try {
    const uploadOptions = {
      folder,
      resource_type: 'auto', // Automatically detect image/video/raw
      ...options,
    };

    // Handle Buffer by using upload_stream, or file path with regular upload
    const result = Buffer.isBuffer(file)
      ? await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          uploadStream.end(file);
        })
      : await cloudinary.uploader.upload(file, uploadOptions);
    
    return {
      url: result.secure_url,
      publicId: result.public_id,
      resourceType: result.resource_type,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      format: result.format,
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
}

/**
 * Delete a file from Cloudinary
 * @param {string} publicId - Public ID of the file to delete
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteFromCloudinary(publicId) {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

/**
 * Delete multiple files from Cloudinary in parallel
 * @param {string[]} publicIds - Array of public IDs to delete
 * @returns {Promise<Array>} Array of deletion results
 */
export async function deleteMultipleFromCloudinary(publicIds) {
  if (!publicIds || publicIds.length === 0) {
    return [];
  }

  // Delete all in parallel
  const deletePromises = publicIds.map((publicId) =>
    deleteFromCloudinary(publicId).catch((error) => {
      // Return error instead of throwing so Promise.all doesn't fail completely
      return { publicId, error: error.message };
    })
  );

  return await Promise.all(deletePromises);
}

/**
 * Generate a video thumbnail by extracting a frame from the video
 * @param {string} publicId - Public ID of the video
 * @param {number} offset - Time offset in seconds (default: 0 for first frame)
 * @returns {string} Thumbnail URL
 */
export function getVideoThumbnail(publicId, offset = 0) {
  return cloudinary.url(publicId, {
    resource_type: 'video',
    secure: true, // Use HTTPS
    format: 'jpg', // Convert to image format
    transformation: [
      { start_offset: offset }, // Extract frame at specified time (0 = first frame)
      { width: 400, height: 300, crop: 'fill' },
      { quality: 'auto' },
    ],
  });
}

export default cloudinary;

