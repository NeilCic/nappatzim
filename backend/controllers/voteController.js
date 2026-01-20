import climbVoteService from "../services/climbVoteService.js";
import climbService from "../services/climbService.js";
import { authService } from "../services/authService.js";
import { z } from "zod";
import logger from "../lib/logger.js";
import { formatZodError } from "../lib/zodErrorFormatter.js";
import { validateGrade } from "../lib/gradeValidation.js";
import DESCRIPTORS from "../../shared/descriptors.js";

const descriptorEnum = z.enum(DESCRIPTORS);

const submitVoteSchema = z.object({
  grade: z.string().min(1, "Grade is required"),
  height: z.number().positive("Height must be positive").optional(),
  descriptors: z.array(descriptorEnum).max(10).optional(),
});

// Get all votes for a climb
export const getVotesByClimbController = async (req, res) => {
  try {
    const { climbId } = req.params;
    const votes = await climbVoteService.getVotesByClimb(climbId);
    res.json({ votes });
  } catch (error) {
    logger.error({ error, climbId: req.params.climbId }, "Error fetching votes");
    res.status(500).json({ error: "Failed to fetch votes" });
  }
};

export const getVoteStatisticsController = async (req, res) => {
  try {
    const { climbId } = req.params;
    const stats = await climbVoteService.getVoteStatistics(climbId);
    res.json({ statistics: stats });
  } catch (error) {
    logger.error({ error, climbId: req.params.climbId }, "Error fetching vote statistics");
    res.status(500).json({ error: "Failed to fetch vote statistics" });
  }
};

export const getMyVoteController = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { climbId } = req.params;
    const vote = await climbVoteService.getVoteByUserAndClimb(climbId, userId);
    
    if (!vote) {
      return res.status(404).json({ error: "Vote not found" });
    }
    
    res.json({ vote });
  } catch (error) {
    logger.error({ error, climbId: req.params.climbId }, "Error fetching user vote");
    res.status(500).json({ error: "Failed to fetch vote" });
  }
};

export const submitVoteController = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { climbId } = req.params;
    const validation = submitVoteSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        fields: formatZodError(validation.error),
      });
    }

    const climb = await climbService.getClimbById(climbId);
    if (!climb) {
      return res.status(404).json({ error: "Climb not found" });
    }

    const gradeValidation = validateGrade(validation.data.grade, climb.gradeSystem, false);
    if (!gradeValidation.valid) {
      return res.status(400).json({
        error: gradeValidation.error || "Invalid grade format",
      });
    }

    let heightToUse = validation.data.height || null;  // todo we dont expect user to give ue height every submission. maybe cache height to avoid user hassle and api call
    if (!heightToUse) {
      const user = await authService.getOne(
        { id: userId },
        undefined,
        { height: true }
      );
      heightToUse = user?.height || null;
    }

    const vote = await climbVoteService.submitOrUpdateVote(
      climbId,
      userId,
      validation.data.grade.trim(),
      climb.gradeSystem,
      heightToUse,
      validation.data.descriptors || []
    );

    res.json({ vote });
  } catch (error) {
    logger.error({ error, climbId: req.params.climbId, userId: req.user?.userId }, "Error submitting vote");
    res.status(500).json({ error: "Failed to submit vote" });
  }
};

export const deleteVoteController = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { climbId } = req.params;
    const result = await climbVoteService.deleteVote(climbId, userId);
    
    // deleteMany returns { count: number }
    if (result.count === 0) {
      return res.status(404).json({ error: "Vote not found" });
    }

    res.status(204).send();
  } catch (error) {
    logger.error({ error, climbId: req.params.climbId }, "Error deleting vote");
    res.status(500).json({ error: "Failed to delete vote" });
  }
};
