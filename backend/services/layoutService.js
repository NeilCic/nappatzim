import PrismaCrudService from "./prismaCrudService.js";
import { LAYOUT_MODEL, SPOT_MODEL, SPOT_VIDEO_MODEL } from "../lib/dbModels.js";
import { uploadToCloudinary, deleteFromCloudinary, deleteMultipleFromCloudinary, getVideoThumbnail, getCloudinaryFolderPrefix } from "./cloudinaryService.js";
import cloudinary from "./cloudinaryService.js";
import logger from "../lib/logger.js";
import prisma from "../lib/prisma.js";

class LayoutService extends PrismaCrudService {
  constructor() {
    super(LAYOUT_MODEL, { spots: { include: { videos: true } } }, { createdAt: "desc" });
  }

  async getAllLayouts() {
    return await this.getAll({
      select: {
        id: true,
        name: true,
        layoutImageUrl: true, // For thumbnail/preview in list
      },
    });
  }

  async getLayoutById(layoutId) {
    return await this.getOne(
      { id: layoutId },
      {
        spots: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
            videos: {
              orderBy: { createdAt: "desc" },
            },
          },
        },
      }
    );
  }

  async createLayout(name, imageFile) {
    // Upload image to Cloudinary
    const uploadResult = await uploadToCloudinary(
      imageFile,
      `${getCloudinaryFolderPrefix()}/layouts`
    );

    // Save to database
    return await this.create({
      name,
      layoutImageUrl: uploadResult.url,
      layoutImagePublicId: uploadResult.publicId,
    });
  }

  async updateLayout(layoutId, name, imageFile, oldPublicId) {
    const updateData = {};
    
    if (name) {
      updateData.name = name;
    }
    
    if (imageFile) {
      const uploadResult = await uploadToCloudinary(
        imageFile,
        `${getCloudinaryFolderPrefix()}/layouts`
      );
      
      updateData.layoutImageUrl = uploadResult.url;
      updateData.layoutImagePublicId = uploadResult.publicId;
      
      if (oldPublicId) {
        try {
          await deleteFromCloudinary(oldPublicId);
        } catch (deleteError) {
          // Log error but don't fail the update - old image might already be deleted
          // This creates orphaned images in Cloudinary that should be cleaned up manually
          logger.warn(
            { deleteError, oldPublicId, layoutId },
            "Failed to delete old layout image from Cloudinary - image may be orphaned"
          );
        }
      }
    }
    
    return await this.update({ id: layoutId }, updateData);
  }

  async deleteLayout(layoutId) {
    const layout = await this.getLayoutById(layoutId);
    
    if (!layout) {
      return null;
    }

    const publicIdsToDelete = [];

    if (layout.layoutImagePublicId) {
      publicIdsToDelete.push(layout.layoutImagePublicId);
    }

    for (const spot of layout.spots || []) {
      for (const video of spot.videos || []) {
        if (video.videoPublicId) {
          publicIdsToDelete.push(video.videoPublicId);
        }
      }
    }

    if (publicIdsToDelete.length > 0) {
      const deleteResults = await deleteMultipleFromCloudinary(publicIdsToDelete);
      
      // Log any failures
      deleteResults.forEach((result) => {
        if (result.error) {
          logger.warn(
            { error: result.error, publicId: result.publicId, layoutId },
            "Failed to delete file from Cloudinary during layout deletion"
          );
        }
      });
    }

    return await this.delete({ id: layoutId });
  }

  /**
   * Compare database layouts with Cloudinary storage to detect orphaned/missing images
   * @returns {Promise<Object>} Comparison results with orphaned and missing images
   * @todo this should be something for an admin. for now it's unused but important to remember it's a thing that should be checked sometime/somehow
   */
  async compareWithCloudinary() {
    // Get all layouts from database
    const layouts = await this.getAll({
      select: {
        id: true,
        name: true,
        layoutImagePublicId: true,
      },
    });

    const dbPublicIds = new Set(
      layouts
        .map((layout) => layout.layoutImagePublicId)
        .filter((id) => id) // Filter out null/undefined
    );

    // Get all images from Cloudinary in the layouts folder
    let cloudinaryPublicIds = new Set();
    try {
      const result = await cloudinary.search
        .expression(`folder:${getCloudinaryFolderPrefix()}/layouts`)
        .execute();

      if (result.resources) {
        cloudinaryPublicIds = new Set(
          result.resources.map((resource) => resource.public_id)
        );
      }
    } catch (error) {
      logger.error({ error }, "Failed to fetch images from Cloudinary");
      throw new Error(`Failed to fetch Cloudinary images: ${error.message}`);
    }

    // Find orphaned images (in Cloudinary but not in DB)
    const orphaned = Array.from(cloudinaryPublicIds).filter(
      (id) => !dbPublicIds.has(id)
    );

    // Find missing images (in DB but not in Cloudinary)
    const missing = Array.from(dbPublicIds).filter(
      (id) => !cloudinaryPublicIds.has(id)
    );

    return {
      databaseCount: layouts.length,
      cloudinaryCount: cloudinaryPublicIds.size,
      orphanedImages: orphaned,
      missingImages: missing,
      matches: dbPublicIds.size - missing.length,
    };
  }
}

class SpotService extends PrismaCrudService {
  constructor() {
    super(SPOT_MODEL, { videos: true }, { createdAt: "desc" });
  }

  async getSpotsByLayout(layoutId) {
    return await this.getAll({
      where: { layoutId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        videos: {
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  async getSpotById(spotId) {
    return await this.getOne(
      { id: spotId },
      {
        layout: true,
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        videos: {
          orderBy: { createdAt: "desc" },
        },
      }
    );
  }

  async createSpot(data) {
    return await this.create(data);
  }

  async updateSpot(spotId, userId, data) {
    return await this.update({ id: spotId, userId }, data);
  }

  async deleteSpot(spotId, userId) {
    // Get spot with videos to delete from Cloudinary
    const spot = await this.getSpotById(spotId);
    
    if (!spot) {
      return null;
    }

    // Verify ownership
    if (spot.userId !== userId) {
      return null;
    }

    // Delete all videos from Cloudinary in bulk
    if (spot.videos && spot.videos.length > 0) {
      const publicIdsToDelete = spot.videos
        .map((video) => video.videoPublicId)
        .filter((id) => id); // Filter out null/undefined

      if (publicIdsToDelete.length > 0) {
        const deleteResults = await deleteMultipleFromCloudinary(publicIdsToDelete);
        
        // Log any failures
        deleteResults.forEach((result) => {
          if (result.error) {
            logger.warn(
              { error: result.error, publicId: result.publicId, spotId },
              "Failed to delete video from Cloudinary during spot deletion - video may be orphaned"
            );
          }
        });
      }
    }

    // Delete spot from database (videos will be cascade deleted)
    return await this.delete({ id: spotId, userId });
  }
}

class SpotVideoService extends PrismaCrudService {
  constructor() {
    super(SPOT_VIDEO_MODEL, { spot: true }, { createdAt: "desc" });
  }

  async getVideosBySpot(spotId) {
    return await this.getAll({
      where: { spotId },
      select: {
        id: true,
        title: true,
        description: true,
        videoUrl: true,
        thumbnailUrl: true,
        duration: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getVideoById(videoId) {
    return await this.getOne(
      { id: videoId },
      {
        spot: {
          include: {
            layout: true,
            user: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
          },
        },
      }
    );
  }

  async createVideo(spotId, title, description, videoFile) {
    // Verify spot exists before uploading to Cloudinary
    const spot = await prisma.spot.findUnique({
      where: { id: spotId },
    });

    if (!spot) {
      throw new Error(`Spot with ID ${spotId} not found`);
    }

    // Upload video to Cloudinary (only after spot is verified)
    const uploadResult = await uploadToCloudinary(
      videoFile,
      `${getCloudinaryFolderPrefix()}/videos`,
      {
        resource_type: 'video',
      }
    );

    // Generate thumbnail URL
    const thumbnailUrl = getVideoThumbnail(uploadResult.publicId);

    // Try to get video metadata (duration) - Cloudinary may need time to process
    let duration = null;
    try {
      const videoInfo = await cloudinary.api.resource(uploadResult.publicId, {
        resource_type: 'video',
      });
      duration = videoInfo.duration || null;
    } catch (error) {
      // Duration might not be available yet, that's okay
      logger.warn({ error, publicId: uploadResult.publicId }, "Could not fetch video duration immediately");
    }

    // Save to database
    try {
      // Use prisma directly with connect syntax for the relation
      return await prisma.spotVideo.create({
        data: {
          spot: {
            connect: { id: spotId },
          },
          title: title || null,
          description: description || null,
          videoUrl: uploadResult.url,
          videoPublicId: uploadResult.publicId,
          thumbnailUrl,
          fileSize: uploadResult.bytes,
          duration,
        },
      });
    } catch (dbError) {
      // If database save fails, try to clean up the Cloudinary upload
      try {
        await deleteFromCloudinary(uploadResult.publicId);
        logger.warn({ publicId: uploadResult.publicId, spotId }, "Cleaned up Cloudinary upload after database save failure");
      } catch (cleanupError) {
        logger.error({ cleanupError, publicId: uploadResult.publicId, spotId }, "Failed to clean up Cloudinary upload after database save failure - video may be orphaned");
      }
      throw dbError;
    }
  }

  async updateVideo(videoId, data) {
    return await this.update({ id: videoId }, data);
  }

  async deleteVideo(videoId) {
    // Get video to find public ID for Cloudinary deletion
    const video = await this.getVideoById(videoId);
    
    if (!video) {
      return null;
    }

    // Delete video from Cloudinary
    if (video.videoPublicId) {
      try {
        await deleteFromCloudinary(video.videoPublicId);
      } catch (cloudinaryError) {
        logger.warn(
          { cloudinaryError, publicId: video.videoPublicId, videoId },
          "Failed to delete video from Cloudinary - video may be orphaned"
        );
      }
    }

    // Delete from database
    return await this.delete({ id: videoId });
  }
}

const layoutService = new LayoutService();
const spotService = new SpotService();
const spotVideoService = new SpotVideoService();

export default {
  layout: layoutService,
  spot: spotService,
  spotVideo: spotVideoService,
};

