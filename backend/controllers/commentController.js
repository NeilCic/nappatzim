import climbCommentService from "../services/climbCommentService.js";
import climbService from "../services/climbService.js";
import authService from "../services/authService.js";
import { z } from "zod";
import logger from "../lib/logger.js";
import { formatZodError } from "../lib/zodErrorFormatter.js";

const createCommentSchema = z.object({
  content: z.string().min(1, "Content is required").max(2000, "Content must be less than 2000 characters"),
  parentCommentId: z.string().optional(),
});

const updateCommentSchema = z.object({
  content: z.string().min(1, "Content is required").max(2000, "Content must be less than 2000 characters"),
});

export const getCommentsByClimbController = async (req, res) => {
  try {
    const { climbId } = req.params;
    const sortBy = req.query.sortBy || "newest"; // newest, oldest, mostLiked

    const climb = await climbService.getClimbById(climbId);
    if (!climb) {
      return res.status(404).json({ error: "Climb not found" });
    }

    const comments = await climbCommentService.getCommentsByClimb(climbId, sortBy);
    res.json({ comments });
  } catch (error) {
    logger.error({ error, climbId: req.params.climbId }, "Error fetching comments");
    res.status(500).json({ error: "Failed to fetch comments" });
  }
};

export const createCommentController = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { climbId } = req.params;
    const validation = createCommentSchema.safeParse(req.body);

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

    const comment = await climbCommentService.createComment(
      climbId,
      userId,
      validation.data.content,
      validation.data.parentCommentId || null
    );

    res.status(201).json({ comment });
  } catch (error) {
    logger.error({ error, climbId: req.params.climbId, userId: req.user?.userId }, "Error creating comment");
    
    if (error.message.includes("not found") || error.message.includes("nesting")) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: "Failed to create comment" });
  }
};

export const updateCommentController = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { commentId } = req.params;
    const validation = updateCommentSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        fields: formatZodError(validation.error),
      });
    }

    const user = await authService.getOne({ id: userId }, undefined, { role: true });
    const isAdmin = user?.role === "admin";

    const comment = await climbCommentService.updateComment(
      commentId,
      userId,
      validation.data.content,
      isAdmin
    );

    res.json({ comment });
  } catch (error) {
    logger.error({ error, commentId: req.params.commentId, userId: req.user?.userId }, "Error updating comment");
    
    if (error.message.includes("not found") || error.message.includes("Unauthorized")) {
      return res.status(error.message.includes("Unauthorized") ? 403 : 404).json({ error: error.message });
    }
    
    res.status(500).json({ error: "Failed to update comment" });
  }
};

export const deleteCommentController = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { commentId } = req.params;

    // Check if user is admin
    const user = await authService.getOne({ id: userId }, undefined, { role: true });
    const isAdmin = user?.role === "admin";

    await climbCommentService.deleteComment(commentId, userId, isAdmin);

    res.status(204).send();
  } catch (error) {
    logger.error({ error, commentId: req.params.commentId, userId: req.user?.userId }, "Error deleting comment");
    
    if (error.message.includes("not found") || error.message.includes("Unauthorized")) {
      return res.status(error.message.includes("Unauthorized") ? 403 : 404).json({ error: error.message });
    }
    
    res.status(500).json({ error: "Failed to delete comment" });
  }
};
