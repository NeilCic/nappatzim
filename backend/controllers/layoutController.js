import layoutService from "../services/layoutService.js";
import spotService from "../services/spotService.js";
import climbVideoService from "../services/climbVideoService.js";
import { z } from "zod";
import logger from "../lib/logger.js";
import { formatZodError } from "../lib/zodErrorFormatter.js";
import { VALIDATION } from "../lib/constants.js";

const isValidUrl = (val) => {
  try {
    new URL(val);
    return true;
  } catch {
    return false;
  }
};

// Schema for creating layout (without image URLs - they come from Cloudinary)
const createLayoutSchema = z.object({
  name: z.string().min(1, "Name is required"),
  gradeSystem: z.enum(["V-Scale", "V-Scale Range", "French"], {
    errorMap: () => ({ message: "Grade system must be 'V-Scale', 'V-Scale Range', or 'French'" }),
  }),
  noMatchColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex code")
    .optional(),
});

// Schema for creating video (without video URLs - they come from Cloudinary)
const createVideoSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
});

const spotSchema = z.object({
  name: z.string()
    .min(VALIDATION.SPOT_NAME.MIN_LENGTH, "Name is required")
    .max(VALIDATION.SPOT_NAME.MAX_LENGTH, `Name must be ${VALIDATION.SPOT_NAME.MAX_LENGTH} characters or less`),
  description: z.string().nullable().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex code").optional(),
  x: z.number().min(0).max(100, "X coordinate must be between 0 and 100"),
  y: z.number().min(0).max(100, "Y coordinate must be between 0 and 100"),
  layoutId: z.string().min(1, "Layout ID is required"),
});

const updateLayoutSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  gradeSystem: z
    .enum(["V-Scale", "V-Scale Range", "French"], {
      errorMap: () => ({
        message: "Grade system must be 'V-Scale', 'V-Scale Range', or 'French'",
      }),
    })
    .optional(),
  noMatchColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex code")
    .optional(),
});

const climbVideoSchema = z.object({
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  videoUrl: z.string().refine(isValidUrl, "Invalid video URL"),
  videoPublicId: z.string().min(1, "Public ID is required"),
  thumbnailUrl: z.string().refine((val) => !val || isValidUrl(val), "Invalid thumbnail URL").optional(),
  fileSize: z.number().int().positive("File size must be positive"),
  duration: z.number().positive("Duration must be positive"),
  climbId: z.string().min(1, "Climb ID is required"),
});

// Layout Controllers
export const getAllLayoutsController = async (req, res) => {
  try {
    const layouts = await layoutService.getAllLayouts();
    res.json({ layouts });
  } catch (error) {
    logger.error({ error, userId: req.user?.userId }, "Error fetching layouts");
    res.status(500).json({ error: "Failed to fetch layouts" });
  }
};

export const getLayoutByIdController = async (req, res) => {
  try {
    const { layoutId } = req.params;
    const layout = await layoutService.getLayoutById(layoutId);
    
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
    const layout = await layoutService.createLayout(
      nameValidation.data.name,
      nameValidation.data.gradeSystem,
      req.file.buffer,
      nameValidation.data.noMatchColor
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
    
    const validation = updateLayoutSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        fields: formatZodError(validation.error),
      });
    }

    const existingLayout = await layoutService.getLayoutById(layoutId);
    if (!existingLayout) {
      return res.status(404).json({ error: "Layout not found" });
    }

    // Service handles optional file upload and database update
    const layout = await layoutService.updateLayout(
      layoutId,
      validation.data.name || null,
      validation.data.gradeSystem || null,
      req.file?.buffer || null,
      existingLayout.layoutImagePublicId,
      validation.data.noMatchColor
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
    
    const deleted = await layoutService.deleteLayout(layoutId);
    
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

    const {
      minProposedGrade,
      maxProposedGrade,
      minVoterGrade,
      maxVoterGrade,
      setterName,
      hasVideo,
    } = req.query;

    // Handle descriptors - can come as 'descriptors[]' or 'descriptors' depending on how Express parses it
    let descriptors = req.query.descriptors || req.query['descriptors[]'];
    const descriptorFilters = Array.isArray(descriptors)
      ? descriptors
      : typeof descriptors === "string" && descriptors.length > 0
      ? descriptors.split(",")
      : [];

    const hasVideoBool =
      typeof hasVideo === "string"
        ? hasVideo.toLowerCase() === "true"
          ? true
          : hasVideo.toLowerCase() === "false"
          ? false
          : undefined
        : undefined;

    const spots = await spotService.getSpotsByLayout(
      layoutId,
      {
        minProposedGrade: typeof minProposedGrade === "string" ? minProposedGrade : undefined,
        maxProposedGrade: typeof maxProposedGrade === "string" ? maxProposedGrade : undefined,
        minVoterGrade: typeof minVoterGrade === "string" ? minVoterGrade : undefined,
        maxVoterGrade: typeof maxVoterGrade === "string" ? maxVoterGrade : undefined,
        descriptors: descriptorFilters,
        setterName: typeof setterName === "string" ? setterName : undefined,
        hasVideo: hasVideoBool,
      }
    );

    // Validate layout exists (if no spots, check layout; if spots exist, layout is included in relation)
    if (spots.length === 0) {
      const layout = await layoutService.getOne(
        { id: layoutId },
        undefined,
        { id: true }
      );
      if (!layout) {
        return res.status(404).json({ error: "Layout not found" });
      }
    }

    res.json({ spots });
  } catch (error) {
    logger.error({ error, layoutId: req.params.layoutId }, "Error fetching spots");
    res.status(500).json({ error: "Failed to fetch spots" });
  }
};

export const getSpotByIdController = async (req, res) => {
  try {
    const { spotId } = req.params;
    const spot = await spotService.getSpotById(spotId);
    
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

    const spot = await spotService.createSpot({
      ...validation.data,
      userId,
    });
    res.status(201).json({ spot });
  } catch (error) {
    logger.error({ error, userId: req.user?.userId }, "Error creating spot");
    if (error.statusCode === 409) {
      return res.status(409).json({ error: error.message });
    }
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
    
    try {
      const spot = await spotService.updateSpot(spotId, userId, validation.data);
      
      if (!spot) {
        return res.status(404).json({ error: "Spot not found or you don't have permission" });
      }
      
      res.json({ spot });
    } catch (error) {
      if (error.statusCode === 409) {
        return res.status(409).json({ error: error.message });
      }
      throw error;
    }
  } catch (error) {
    logger.error({ error, spotId: req.params.spotId, userId: req.user?.userId }, "Error updating spot");
    res.status(500).json({ error: "Failed to update spot" });
  }
};

export const deleteSpotController = async (req, res) => {
  try {
    const { spotId } = req.params;
    const userId = req.user?.userId;
    
    const deleted = await spotService.deleteSpot(spotId, userId);
    
    if (!deleted) {
      return res.status(404).json({ error: "Spot not found or you don't have permission" });
    }

    res.status(204).send();
  } catch (error) {
    logger.error({ error, spotId: req.params.spotId, userId: req.user?.userId }, "Error deleting spot");
    res.status(500).json({ error: "Failed to delete spot" });
  }
};

export const getVideosByClimbController = async (req, res) => {
  try {
    const { climbId } = req.params;
    const videos = await climbVideoService.getVideosByClimb(climbId);
    res.json({ videos });
  } catch (error) {
    logger.error({ error, climbId: req.params.climbId }, "Error fetching videos");
    res.status(500).json({ error: "Failed to fetch videos" });
  }
};

export const getVideoByIdController = async (req, res) => {
  try {
    const { videoId } = req.params;
    const video = await climbVideoService.getVideoById(videoId);
    
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
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Video file is required" });
    }

    const { climbId } = req.params;
    if (!climbId) {
      return res.status(400).json({ error: "Climb ID is required" });
    }

    const validation = createVideoSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        fields: formatZodError(validation.error),
      });
    }

    const video = await climbVideoService.createVideo(
      climbId,
      userId,
      validation.data.title || null,
      validation.data.description || null,
      req.file.buffer
    );

    res.status(201).json({ video });
  } catch (error) {
    logger.error({ error, climbId: req.params.climbId }, "Error creating video");
    
    // Return appropriate error message
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }

    if (error.statusCode === 409) {
      return res.status(409).json({ error: error.message || "You have already uploaded a video for this climb" });
    }
    
    res.status(500).json({ error: "Failed to create video" });
  }
};

export const updateVideoController = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { videoId } = req.params;
    const validation = climbVideoSchema.partial().safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        fields: formatZodError(validation.error),
      });
    }

    const video = await climbVideoService.updateVideo(videoId, userId, validation.data);
    
    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }
    
    res.json({ video });
  } catch (error) {
    logger.error({ error, videoId: req.params.videoId }, "Error updating video");
    
    if (error.message?.includes('Unauthorized')) {
      return res.status(403).json({ error: error.message });
    }
    
    res.status(500).json({ error: "Failed to update video" });
  }
};

export const deleteVideoController = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { videoId } = req.params;
    
    const deleted = await climbVideoService.deleteVideo(videoId, userId);
    
    if (!deleted) {
      return res.status(404).json({ error: "Video not found" });
    }

    res.status(204).send();
  } catch (error) {
    logger.error({ error, videoId: req.params.videoId }, "Error deleting video");
    
    if (error.message?.includes('Unauthorized')) {
      return res.status(403).json({ error: error.message });
    }
    
    res.status(500).json({ error: "Failed to delete video" });
  }
};

export const compareLayoutsWithCloudinaryController = async (req, res) => {  // todo this should be something for an admin. for now it's unused but important to remember it's a thing that should be checked sometime/somehow
  try {
    const comparison = await layoutService.compareWithCloudinary();
    res.json(comparison);
  } catch (error) {
    logger.error({ error }, "Error comparing layouts with Cloudinary");
    res.status(500).json({ error: "Failed to compare layouts with Cloudinary" });
  }
};

