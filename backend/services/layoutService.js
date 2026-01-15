import PrismaCrudService from "./prismaCrudService.js";
import { LAYOUT_MODEL } from "../lib/dbModels.js";
import { uploadToCloudinary, deleteFromCloudinary, deleteMultipleFromCloudinary, getCloudinaryFolderPrefix } from "./cloudinaryService.js";
import cloudinary from "./cloudinaryService.js";
import logger from "../lib/logger.js";

class LayoutService extends PrismaCrudService {
  constructor() {
    super(LAYOUT_MODEL, { spots: { include: { climbs: { include: { videos: true } } } } }, { createdAt: "desc" });
  }

  async getAllLayouts() {
    return await this.getAll({
      select: {
        id: true,
        name: true,
        layoutImageUrl: true,
        gradeSystem: true,
        noMatchColor: true,
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
            climbs: {
              include: {
                videos: {
                  orderBy: { createdAt: "desc" },
                },
              },
            },
          },
        },
      }
    );
  }

  async createLayout(name, gradeSystem, imageFile, noMatchColor) {
    const uploadResult = await uploadToCloudinary(
      imageFile,
      `${getCloudinaryFolderPrefix()}/layouts`
    );

    try {
      return await this.create({
        name,
        gradeSystem,
        layoutImageUrl: uploadResult.url,
        layoutImagePublicId: uploadResult.publicId,
        ...(noMatchColor ? { noMatchColor } : {}),
      });
    } catch (dbError) {
      // If database save fails, rollback by deleting from Cloudinary
      try {
        await deleteFromCloudinary(uploadResult.publicId);
        logger.warn({ publicId: uploadResult.publicId, name }, "Rolled back Cloudinary upload after database save failure");
      } catch (cleanupError) {
        logger.error({ cleanupError, publicId: uploadResult.publicId, name }, "Failed to rollback Cloudinary upload after database save failure - image may be orphaned");
      }
      throw dbError;
    }
  }

  async updateLayout(layoutId, name, gradeSystem, imageFile, oldPublicId, noMatchColor) {
    const updateData = {};
    let uploadResult = null;
    
    if (name) {
      updateData.name = name;
    }
    
    if (gradeSystem) {
      updateData.gradeSystem = gradeSystem;
    }

    if (noMatchColor !== undefined) {
      updateData.noMatchColor = noMatchColor;
    }
    
    if (imageFile) {
      uploadResult = await uploadToCloudinary(
        imageFile,
        `${getCloudinaryFolderPrefix()}/layouts`
      );
      
      updateData.layoutImageUrl = uploadResult.url;
      updateData.layoutImagePublicId = uploadResult.publicId;
    }
    
    try {
      const updatedLayout = await this.update({ id: layoutId }, updateData);
      
      // Only delete old image AFTER database update succeeds
      if (uploadResult && oldPublicId) {
        try {
          await deleteFromCloudinary(oldPublicId);
        } catch (deleteError) {
          // Log error but don't fail - old image might already be deleted
          // The new image is already in DB, so this is just cleanup
          logger.warn(
            { deleteError, oldPublicId, layoutId },
            "Failed to delete old layout image from Cloudinary - image may be orphaned"
          );
        }
      }
      
      return updatedLayout;
    } catch (dbError) {
      // If database update fails, rollback by deleting the new Cloudinary upload
      if (uploadResult) {
        try {
          await deleteFromCloudinary(uploadResult.publicId);
          logger.warn({ publicId: uploadResult.publicId, layoutId }, "Rolled back Cloudinary upload after database update failure");
        } catch (cleanupError) {
          logger.error({ cleanupError, publicId: uploadResult.publicId, layoutId }, "Failed to rollback Cloudinary upload after database update failure - image may be orphaned");
        }
      }
      throw dbError;
    }
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
      for (const climb of spot.climbs || []) {
        if (climb.videos) {
          for (const video of climb.videos) {
            if (video.videoPublicId) {
              publicIdsToDelete.push(video.videoPublicId);
            }
          }
        }
      }
    }

    if (publicIdsToDelete.length > 0) {
      const deleteResults = await deleteMultipleFromCloudinary(publicIdsToDelete);
      
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

const layoutService = new LayoutService();

export default layoutService;

