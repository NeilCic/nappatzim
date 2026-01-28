import PrismaCrudService from "./prismaCrudService.js";
import { SPOT_MODEL } from "../lib/dbModels.js";
import { deleteMultipleFromCloudinary } from "./cloudinaryService.js";
import logger from "../lib/logger.js";
import { gradeToNumber } from "../lib/gradeUtils.js";
import prisma from "../lib/prisma.js";

class SpotService extends PrismaCrudService {
  constructor() {
    super(SPOT_MODEL, { climbs: { include: { videos: true } } }, { createdAt: "desc" });
  }

  async getSpotsByLayout(layoutId, filters = {}, gradeSystem = null) {
    const {
      minProposedGrade,
      maxProposedGrade,
      minVoterGrade,
      maxVoterGrade,
      descriptors,
      setterName,
      hasVideo,
    } = filters;

    const spots = await this.getAll({
      where: { layoutId },
      include: {
        layout: {
          select: {
            id: true,
            gradeSystem: true,
            noMatchColor: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        climbs: {
          include: {
            setter: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
            videos: {
              orderBy: { createdAt: "desc" },
            },
            votes: {
              select: {
                grade: true,
                gradeSystem: true,
                descriptors: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    // Extract gradeSystem from layout relation (all spots belong to same layout)
    // Use provided gradeSystem as fallback (for backwards compatibility or if no spots)
    const layoutGradeSystem = spots.length > 0 ? spots[0].layout?.gradeSystem : gradeSystem;

    const hasAnyFilter =
      !!(minProposedGrade || maxProposedGrade || minVoterGrade || maxVoterGrade) ||
      (Array.isArray(descriptors) && descriptors.length > 0) ||
      (typeof setterName === "string" && setterName.trim().length > 0) ||
      typeof hasVideo === "boolean";

    if (!hasAnyFilter) {
      return spots;
    }

    // Precompute numeric bounds for grade filters (if provided)
    const minProposedNumeric =
      minProposedGrade && layoutGradeSystem
        ? gradeToNumber(minProposedGrade, layoutGradeSystem)
        : null;
    const maxProposedNumeric =
      maxProposedGrade && layoutGradeSystem
        ? gradeToNumber(maxProposedGrade, layoutGradeSystem)
        : null;

    const minVoterNumeric =
      minVoterGrade && layoutGradeSystem ? gradeToNumber(minVoterGrade, layoutGradeSystem) : null;
    const maxVoterNumeric =
      maxVoterGrade && layoutGradeSystem ? gradeToNumber(maxVoterGrade, layoutGradeSystem) : null;

    const normalizedDescriptors = Array.isArray(descriptors)
      ? descriptors.filter(Boolean)
      : [];

    const normalizedSetter = (setterName || "").trim().toLowerCase();

    const filteredSpots = spots.map((spot) => {
      const filteredClimbs = (spot.climbs || []).filter((climb) => {
          if (minProposedNumeric !== null || maxProposedNumeric !== null) {
            const climbNumeric = gradeToNumber(climb.grade, climb.gradeSystem || layoutGradeSystem);
          if (climbNumeric === null) {
            return false;
          }
          if (minProposedNumeric !== null && climbNumeric < minProposedNumeric) {
            return false;
          }
          if (maxProposedNumeric !== null && climbNumeric > maxProposedNumeric) {
            return false;
          }
        }

        // Voter average grade range filter
        if (minVoterNumeric !== null || maxVoterNumeric !== null) {
          const voteGrades = (climb.votes || []).map((v) => v.grade).filter(Boolean);
          if (voteGrades.length === 0) {
            return false;
          }

          const numericVotes = voteGrades
            .map((g) => gradeToNumber(g, climb.gradeSystem || layoutGradeSystem))
            .filter((n) => n !== null);

          if (numericVotes.length === 0) {
            return false;
          }

          const avg =
            numericVotes.reduce((sum, n) => sum + n, 0) / numericVotes.length;

          if (minVoterNumeric !== null && avg < minVoterNumeric) {
            return false;
          }
          if (maxVoterNumeric !== null && avg > maxVoterNumeric) {
            return false;
          }
        }

        // Descriptors filter (ALL selected descriptors must be present)
        if (normalizedDescriptors.length > 0) {
          const climbDescriptorSet = new Set();
          (climb.votes || []).forEach((v) => {
            if (Array.isArray(v.descriptors)) {
              v.descriptors.forEach((d) => {
                if (d && typeof d === 'string') {
                  climbDescriptorSet.add(d.trim().toLowerCase());
                }
              });
            }
          });

          const normalizedFilterDescriptors = normalizedDescriptors.map(d => 
            typeof d === 'string' ? d.trim().toLowerCase() : d
          );

          const allMatch = normalizedFilterDescriptors.every((d) =>
            climbDescriptorSet.has(d)
          );
          if (!allMatch) {
            return false;
          }
        }

        // Setter name partial match
        if (normalizedSetter) {
          const setterUsername = (climb.setter?.username || "").toLowerCase();
          if (!setterUsername.includes(normalizedSetter)) {
            return false;
          }
        }

        // Has video filter
        if (typeof hasVideo === "boolean") {
          const climbHasVideo = Array.isArray(climb.videos) && climb.videos.length > 0;
          if (hasVideo && !climbHasVideo) {
            return false;
          }
          if (!hasVideo && climbHasVideo) {
            return false;
          }
        }

        return true;
      });

      return {
        ...spot,
        climbs: filteredClimbs,
      };
    });

    return filteredSpots;
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
    try {
      return await this.create({
        ...data,
        name: data.name.trim(),
      });
    } catch (error) {
      // Handle Prisma unique constraint violation (P2002)
      if (error.code === 'P2002' && error.meta?.target?.includes('name')) {
        const conflictError = new Error("A spot with this name already exists in this layout");
        conflictError.statusCode = 409; // Conflict
        throw conflictError;
      }
      throw error;
    }
  }

  async updateSpot(spotId, data) {
    if (data.name) {
      data.name = data.name.trim();
    }

    try {
      return await this.update({ id: spotId }, data);
    } catch (error) {
      // Handle Prisma unique constraint violation (P2002)
      if (error.code === 'P2002' && error.meta?.target?.includes('name')) {
        const conflictError = new Error("A spot with this name already exists in this layout");
        conflictError.statusCode = 409; // Conflict
        throw conflictError;
      }
      throw error;
    }
  }

  async deleteSpot(spotId) {
    const spot = await this.getSpotById(spotId);
    
    if (!spot) {
      return null;
    }

    // Delete all videos from Cloudinary in bulk (from all climbs at this spot)
    await this._deleteSpotVideos(spot, spotId, "deletion");

    // Delete spot from database (climbs and their videos will be cascade deleted)
    return await this.delete({ id: spotId });
  }

  async resetSpot(spotId) {
    const spot = await this.getSpotById(spotId);

    if (!spot) {
      return null;
    }

    // Delete all videos from Cloudinary for all climbs at this spot
    await this._deleteSpotVideos(spot, spotId, "reset");

    // Delete all climbs for this spot; related data is cascade-deleted via Prisma schema
    await prisma.climb.deleteMany({
      where: { spotId },
    });

    // Return the refreshed spot (with no climbs)
    return await this.getSpotById(spotId);
  }

  /**
   * Helper to delete all Cloudinary videos associated with a spot's climbs.
   * mode is used only to adjust log messages (e.g. "deletion" vs "reset").
   */
  async _deleteSpotVideos(spot, spotId, mode = "deletion") {
    if (!spot?.climbs || spot.climbs.length === 0) {
      return;
    }

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

    if (publicIdsToDelete.length === 0) {
      return;
    }

    const deleteResults = await deleteMultipleFromCloudinary(publicIdsToDelete);

    deleteResults.forEach((result) => {
      if (result.error) {
        logger.warn(
          { error: result.error, publicId: result.publicId, spotId },
          `Failed to delete video from Cloudinary during spot ${mode} - video may be orphaned`
        );
      }
    });
  }
}

const spotService = new SpotService();

export default spotService;
