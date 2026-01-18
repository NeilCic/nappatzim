import PrismaCrudService from "./prismaCrudService.js";
import { CLIMB_VIDEO_MODEL } from "../lib/dbModels.js";
import { uploadToCloudinary, deleteFromCloudinary, getVideoThumbnail, getCloudinaryFolderPrefix } from "./cloudinaryService.js";
import cloudinary from "./cloudinaryService.js";
import logger from "../lib/logger.js";
import climbService from "./climbService.js";

class ClimbVideoService extends PrismaCrudService {
  constructor() {
    super(CLIMB_VIDEO_MODEL, { climb: { include: { spot: true } } }, { createdAt: "desc" });
  }

  async getVideosByClimb(climbId) {
    return await this.getAll({
      where: { climbId },
      select: {
        id: true,
        title: true,
        description: true,
        videoUrl: true,
        thumbnailUrl: true,
        duration: true,
        createdAt: true,
        userId: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getVideoById(videoId) {
    return await this.getOne(
      { id: videoId },
      {
        climb: {
          include: {
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
          },
        },
      }
    );
  }

  async createVideo(climbId, userId, title, description, videoFile) {
    const climb = await climbService.getClimbById(climbId);

    if (!climb) {
      throw new Error(`Climb with ID ${climbId} not found`);
    }

    const uploadResult = await uploadToCloudinary(
      videoFile,
      `${getCloudinaryFolderPrefix()}/videos`,
      {
        resource_type: 'video',
      }
    );

    const thumbnailUrl = getVideoThumbnail(uploadResult.publicId);

    let duration = null;
    try {
      const videoInfo = await cloudinary.api.resource(uploadResult.publicId, {
        resource_type: 'video',
      });
      duration = videoInfo.duration || null;
    } catch (error) {
      logger.warn({ error, publicId: uploadResult.publicId }, "Could not fetch video duration immediately");
    }

    try {
      return await this.create({
        climb: {
          connect: { id: climbId },
        },
        user: {
          connect: { id: userId },
        },
        title: title || null,
        description: description || null,
        videoUrl: uploadResult.url,
        videoPublicId: uploadResult.publicId,
        thumbnailUrl,
        fileSize: uploadResult.bytes,
        duration,
      });
    } catch (dbError) {
      // If database save fails, try to clean up the Cloudinary upload
      try {
        await deleteFromCloudinary(uploadResult.publicId);
        logger.warn({ publicId: uploadResult.publicId, climbId }, "Cleaned up Cloudinary upload after database save failure");
      } catch (cleanupError) {
        logger.error({ cleanupError, publicId: uploadResult.publicId, climbId }, "Failed to clean up Cloudinary upload after database save failure - video may be orphaned");
      }
      throw dbError;
    }
  }

  async updateVideo(videoId, userId, data) {
    const video = await this.getVideoById(videoId);
    if (!video) {
      return null;
    }
    if (video.userId !== userId) {
      throw new Error("Unauthorized: You can only update your own videos");
    }
    return await this.update({ id: videoId }, data);
  }

  async deleteVideo(videoId, userId) {
    const video = await this.getVideoById(videoId);
    
    if (!video) {
      return null;
    }

    // Check ownership
    if (video.userId !== userId) {
      throw new Error("Unauthorized: You can only delete your own videos");
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

const climbVideoService = new ClimbVideoService();

export default climbVideoService;
