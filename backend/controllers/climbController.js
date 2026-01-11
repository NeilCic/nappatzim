import climbService from "../services/climbService.js";
import spotService from "../services/spotService.js";
import layoutService from "../services/layoutService.js";
import { z } from "zod";
import logger from "../lib/logger.js";
import { formatZodError } from "../lib/zodErrorFormatter.js";
import { validateGrade } from "../lib/gradeValidation.js";

const createClimbSchema = z.object({
  spotId: z.string().min(1, "Spot ID is required"),
  grade: z.string().min(1, "Grade is required"),
  gradeSystem: z.enum(["V-Scale", "V-Scale Range", "French"], {
    errorMap: () => ({ message: "Grade system must be 'V-Scale', 'V-Scale Range', or 'French'" }),
  }),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex code"),
  length: z.number().positive("Length must be positive").optional(),
  setterId: z.string().optional(),
});

const updateClimbSchema = z.object({
  grade: z.string().min(1, "Grade is required").optional(),
  gradeSystem: z.enum(["V-Scale", "V-Scale Range", "French"], {
    errorMap: () => ({ message: "Grade system must be 'V-Scale', 'V-Scale Range', or 'French'" }),
  }).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex code").optional(),
  length: z.number().positive("Length must be positive").nullable().optional(),
  setterId: z.string().nullable().optional(),
});

export const getClimbsBySpotController = async (req, res) => {
  try {
    const { spotId } = req.params;
    const climbs = await climbService.getClimbsBySpot(spotId);
    res.json({ climbs });
  } catch (error) {
    logger.error({ error, spotId: req.params.spotId }, "Error fetching climbs");
    res.status(500).json({ error: "Failed to fetch climbs" });
  }
};

export const getClimbByIdController = async (req, res) => {
  try {
    const { climbId } = req.params;
    const climb = await climbService.getClimbById(climbId);
    
    if (!climb) {
      return res.status(404).json({ error: "Climb not found" });
    }
    
    res.json({ climb });
  } catch (error) {
    logger.error({ error, climbId: req.params.climbId }, "Error fetching climb");
    res.status(500).json({ error: "Failed to fetch climb" });
  }
};

export const createClimbController = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const spotId = req.params.spotId;
    if (!spotId) {
      return res.status(400).json({ error: "Spot ID is required" });
    }

    const validation = createClimbSchema.omit({ spotId: true }).safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        fields: formatZodError(validation.error),
      });
    }

    const spot = await spotService.getSpotById(spotId);
    if (!spot) {
      return res.status(404).json({ error: "Spot not found" });
    }

    const layout = await layoutService.getLayoutById(spot.layoutId);
    if (!layout) {
      return res.status(404).json({ error: "Layout not found" });
    }

    if (validation.data.gradeSystem !== layout.gradeSystem) {
      return res.status(400).json({ 
        error: `Grade system must match layout's grade system: ${layout.gradeSystem}` 
      });
    }

    const gradeValidation = validateGrade(validation.data.grade, validation.data.gradeSystem);
    if (!gradeValidation.valid) {
      return res.status(400).json({
        error: gradeValidation.error || "Invalid grade format",
      });
    }

    const climb = await climbService.createClimb({
      spotId,
      grade: validation.data.grade.trim(),
      gradeSystem: validation.data.gradeSystem,
      color: validation.data.color,
      length: validation.data.length || null,
      setterId: validation.data.setterId || null,
    });

    res.status(201).json({ climb });
  } catch (error) {
    logger.error({ error, userId: req.user?.userId }, "Error creating climb");
    res.status(500).json({ error: "Failed to create climb" });
  }
};

export const updateClimbController = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { climbId } = req.params;
    const validation = updateClimbSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        fields: formatZodError(validation.error),
      });
    }

    const existingClimb = await climbService.getClimbById(climbId);
    if (!existingClimb) {
      return res.status(404).json({ error: "Climb not found" });
    }

    if (validation.data.gradeSystem && validation.data.gradeSystem !== existingClimb.spot.layout.gradeSystem) {
      return res.status(400).json({ 
        error: `Grade system must match layout's grade system: ${existingClimb.spot.layout.gradeSystem}` 
      });
    }

    // Determine which gradeSystem to use for validation (use new one if provided, otherwise existing)
    const gradeSystemToUse = validation.data.gradeSystem || existingClimb.gradeSystem;

    // Validate grade format if grade is being updated
    if (validation.data.grade) {
      const gradeValidation = validateGrade(validation.data.grade, gradeSystemToUse);
      if (!gradeValidation.valid) {
        return res.status(400).json({
          error: gradeValidation.error || "Invalid grade format",
        });
      }
    }

    const updateData = { ...validation.data };
    if (updateData.grade) {
      updateData.grade = updateData.grade.trim();
    }

    const climb = await climbService.updateClimb(climbId, userId, updateData);
    
    if (!climb) {
      return res.status(404).json({ error: "Climb not found" });
    }
    
    res.json({ climb });
  } catch (error) {
    logger.error({ error, climbId: req.params.climbId }, "Error updating climb");
    res.status(500).json({ error: "Failed to update climb" });
  }
};

export const deleteClimbController = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { climbId } = req.params;
    const deleted = await climbService.deleteClimb(climbId, userId);
    
    if (!deleted) {
      return res.status(404).json({ error: "Climb not found" });
    }

    res.status(204).send();
  } catch (error) {
    logger.error({ error, climbId: req.params.climbId }, "Error deleting climb");
    res.status(500).json({ error: "Failed to delete climb" });
  }
};
