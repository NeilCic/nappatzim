import layoutService from "../services/layoutService.js";
import { z } from "zod";
import logger from "../lib/logger.js";
import { formatZodError } from "../lib/zodErrorFormatter.js";

const isValidUrl = (val) => {
  try {
    new URL(val);
    return true;
  } catch {
    return false;
  }
};

const layoutSchema = z.object({
  name: z.string().min(1, "Name is required"),
  layoutImageUrl: z.string().refine(isValidUrl, "Invalid image URL"),
  layoutImagePublicId: z.string().min(1, "Public ID is required"),
});

// Schema for creating layout (without image URLs - they come from Cloudinary)
const createLayoutSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

// Schema for creating video (without video URLs - they come from Cloudinary)
const createVideoSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  spotId: z.string().min(1, "Spot ID is required"),
});

const spotSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex code").optional(),
  x: z.number().min(0).max(100, "X coordinate must be between 0 and 100"),
  y: z.number().min(0).max(100, "Y coordinate must be between 0 and 100"),
  layoutId: z.string().min(1, "Layout ID is required"),
});

const spotVideoSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  videoUrl: z.string().refine(isValidUrl, "Invalid video URL"),
  videoPublicId: z.string().min(1, "Public ID is required"),
  thumbnailUrl: z.string().refine((val) => !val || isValidUrl(val), "Invalid thumbnail URL").optional(),
  fileSize: z.number().int().positive("File size must be positive"),
  duration: z.number().positive("Duration must be positive"),
  spotId: z.string().min(1, "Spot ID is required"),
});

// Layout Controllers
export const getAllLayoutsController = async (req, res) => {
  try {
    const layouts = await layoutService.layout.getAllLayouts();
    res.json({ layouts });
  } catch (error) {
    logger.error({ error, userId: req.user?.userId }, "Error fetching layouts");
    res.status(500).json({ error: "Failed to fetch layouts" });
  }
};

export const getLayoutByIdController = async (req, res) => {
  try {
    const { layoutId } = req.params;
    const layout = await layoutService.layout.getLayoutById(layoutId);
    
    if (!layout) {
      return res.status(404).json({ error: "Layout not found" });
    }
    
    res.json({ layout });
  } catch (error) {
    logger.error({ error, layoutId: req.params.layoutId }, "Error fetching layout");
    res.status(500).json({ error: "Failed to fetch layout" });
  }
};

export const createLayoutController = async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: "Layout image is required" });
    }

    // Validate name field
    const nameValidation = createLayoutSchema.safeParse(req.body);
    if (!nameValidation.success) {
      return res.status(400).json({
        error: "Validation failed",
        fields: formatZodError(nameValidation.error),
      });
    }

    // Service handles Cloudinary upload and database save
    const layout = await layoutService.layout.createLayout(
      nameValidation.data.name,
      req.file.buffer
    );

    res.status(201).json({ layout });
  } catch (error) {
    logger.error({ error, userId: req.user?.userId }, "Error creating layout");
    res.status(500).json({ error: "Failed to create layout" });
  }
};

export const updateLayoutController = async (req, res) => {
  try {
    const { layoutId } = req.params;
    
    const nameValidation = createLayoutSchema.partial().safeParse(req.body);
    if (!nameValidation.success) {
      return res.status(400).json({
        error: "Validation failed",
        fields: formatZodError(nameValidation.error),
      });
    }

    const existingLayout = await layoutService.layout.getLayoutById(layoutId);
    if (!existingLayout) {
      return res.status(404).json({ error: "Layout not found" });
    }

    // Service handles optional file upload and database update
    const layout = await layoutService.layout.updateLayout(
      layoutId,
      nameValidation.data.name || null,
      req.file?.buffer || null,
      existingLayout.layoutImagePublicId
    );
    
    res.json({ layout });
  } catch (error) {
    logger.error({ error, layoutId: req.params.layoutId }, "Error updating layout");
    res.status(500).json({ error: "Failed to update layout" });
  }
};

export const deleteLayoutController = async (req, res) => {
  try {
    const { layoutId } = req.params;
    
    const deleted = await layoutService.layout.deleteLayout(layoutId);
    
    if (!deleted) {
      return res.status(404).json({ error: "Layout not found" });
    }

    res.status(204).send();
  } catch (error) {
    logger.error({ error, layoutId: req.params.layoutId }, "Error deleting layout");
    res.status(500).json({ error: "Failed to delete layout" });
  }
};

// Spot Controllers
export const getSpotsByLayoutController = async (req, res) => {
  try {
    const { layoutId } = req.params;
    const spots = await layoutService.spot.getSpotsByLayout(layoutId);
    res.json({ spots });
  } catch (error) {
    logger.error({ error, layoutId: req.params.layoutId }, "Error fetching spots");
    res.status(500).json({ error: "Failed to fetch spots" });
  }
};

export const getSpotByIdController = async (req, res) => {
  try {
    const { spotId } = req.params;
    const spot = await layoutService.spot.getSpotById(spotId);
    
    if (!spot) {
      return res.status(404).json({ error: "Spot not found" });
    }
    
    res.json({ spot });
  } catch (error) {
    logger.error({ error, spotId: req.params.spotId }, "Error fetching spot");
    res.status(500).json({ error: "Failed to fetch spot" });
  }
};

export const createSpotController = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const validation = spotSchema.safeParse({ ...req.body, userId });
    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        fields: formatZodError(validation.error),
      });
    }

    const spot = await layoutService.spot.createSpot({
      ...validation.data,
      userId,
    });
    res.status(201).json({ spot });
  } catch (error) {
    logger.error({ error, userId: req.user?.userId }, "Error creating spot");
    res.status(500).json({ error: "Failed to create spot" });
  }
};

export const updateSpotController = async (req, res) => {
  try {
    const { spotId } = req.params;
    const validation = spotSchema.partial().safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        fields: formatZodError(validation.error),
      });
    }

    const userId = req.user?.userId;
    const spot = await layoutService.spot.updateSpot(spotId, userId, validation.data);
    
    if (!spot) {
      return res.status(404).json({ error: "Spot not found or you don't have permission" });
    }
    
    res.json({ spot });
  } catch (error) {
    logger.error({ error, spotId: req.params.spotId, userId: req.user?.userId }, "Error updating spot");
    res.status(500).json({ error: "Failed to update spot" });
  }
};

export const deleteSpotController = async (req, res) => {
  try {
    const { spotId } = req.params;
    const spot = await layoutService.spot.getSpotById(spotId);
    
    if (!spot) {
      return res.status(404).json({ error: "Spot not found" });
    }

    const userId = req.user?.userId;
    if (spot.userId !== userId) {
      return res.status(403).json({ error: "You can only delete your own spots" });
    }

    // Delete all videos from Cloudinary
    for (const video of spot.videos || []) {
      if (video.videoPublicId) {
        try {
          await deleteFromCloudinary(video.videoPublicId);
        } catch (cloudinaryError) {
          logger.warn({ cloudinaryError, publicId: video.videoPublicId }, "Failed to delete video from Cloudinary");
        }
      }
    }

    await layoutService.spot.deleteSpot(spotId, userId);
    res.status(204).send();
  } catch (error) {
    logger.error({ error, spotId: req.params.spotId, userId: req.user?.userId }, "Error deleting spot");
    res.status(500).json({ error: "Failed to delete spot" });
  }
};

export const getVideosBySpotController = async (req, res) => {
  try {
    const { spotId } = req.params;
    const videos = await layoutService.spotVideo.getVideosBySpot(spotId);
    res.json({ videos });
  } catch (error) {
    logger.error({ error, spotId: req.params.spotId }, "Error fetching videos");
    res.status(500).json({ error: "Failed to fetch videos" });
  }
};

export const getVideoByIdController = async (req, res) => {
  try {
    const { videoId } = req.params;
    const video = await layoutService.spotVideo.getVideoById(videoId);
    
    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }
    
    res.json({ video });
  } catch (error) {
    logger.error({ error, videoId: req.params.videoId }, "Error fetching video");
    res.status(500).json({ error: "Failed to fetch video" });
  }
};

export const createVideoController = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Video file is required" });
    }

    const validation = createVideoSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        fields: formatZodError(validation.error),
      });
    }

    const video = await layoutService.spotVideo.createVideo(
      validation.data.spotId,
      validation.data.title || null,
      validation.data.description || null,
      req.file.buffer
    );

    res.status(201).json({ video });
  } catch (error) {
    logger.error({ error, spotId: req.body.spotId }, "Error creating video");
    res.status(500).json({ error: "Failed to create video" });
  }
};

export const updateVideoController = async (req, res) => {
  try {
    const { videoId } = req.params;
    const validation = spotVideoSchema.partial().safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        fields: formatZodError(validation.error),
      });
    }

    const video = await layoutService.spotVideo.updateVideo(videoId, validation.data);
    
    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }
    
    res.json({ video });
  } catch (error) {
    logger.error({ error, videoId: req.params.videoId }, "Error updating video");
    res.status(500).json({ error: "Failed to update video" });
  }
};

export const deleteVideoController = async (req, res) => {
  try {
    const { videoId } = req.params;
    
    const deleted = await layoutService.spotVideo.deleteVideo(videoId);
    
    if (!deleted) {
      return res.status(404).json({ error: "Video not found" });
    }

    res.status(204).send();
  } catch (error) {
    logger.error({ error, videoId: req.params.videoId }, "Error deleting video");
    res.status(500).json({ error: "Failed to delete video" });
  }
};

export const compareLayoutsWithCloudinaryController = async (req, res) => {  // todo this should be something for an admin. for now it's unused but important to remember it's a thing that should be checked sometime/somehow
  try {
    const comparison = await layoutService.layout.compareWithCloudinary();
    res.json(comparison);
  } catch (error) {
    logger.error({ error }, "Error comparing layouts with Cloudinary");
    res.status(500).json({ error: "Failed to compare layouts with Cloudinary" });
  }
};

