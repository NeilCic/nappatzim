import PrismaCrudService from "./prismaCrudService.js";
import { SPOT_MODEL } from "../lib/dbModels.js";
import { deleteMultipleFromCloudinary } from "./cloudinaryService.js";
import logger from "../lib/logger.js";

class SpotService extends PrismaCrudService {
  constructor() {
    super(SPOT_MODEL, { climbs: { include: { videos: true } } }, { createdAt: "desc" });
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
        climbs: {
          include: {
            videos: {
              orderBy: { createdAt: "desc" },
            },
          },
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
        climbs: {
          include: {
            videos: {
              orderBy: { createdAt: "desc" },
            },
          },
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
    const spot = await this.getSpotById(spotId);
    
    if (!spot) {
      return null;
    }

    if (spot.userId !== userId) {
      return null;
    }

    // Delete all videos from Cloudinary in bulk (from all climbs at this spot)
    if (spot.climbs && spot.climbs.length > 0) {
      const publicIdsToDelete = [];
      for (const climb of spot.climbs) {
        if (climb.videos) {
          for (const video of climb.videos) {
            if (video.videoPublicId) {
              publicIdsToDelete.push(video.videoPublicId);
            }
          }
        }
      }

      if (publicIdsToDelete.length > 0) {
        const deleteResults = await deleteMultipleFromCloudinary(publicIdsToDelete);
        
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

    // Delete spot from database (climbs and their videos will be cascade deleted)
    return await this.delete({ id: spotId, userId });
  }
}

const spotService = new SpotService();

export default spotService;
