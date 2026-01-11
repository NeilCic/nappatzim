import climbReactionService from "../services/climbReactionService.js";
import climbCommentService from "../services/climbCommentService.js";
import { z } from "zod";
import logger from "../lib/logger.js";
import { formatZodError } from "../lib/zodErrorFormatter.js";

const submitReactionSchema = z.object({
  reaction: z.enum(["like", "dislike"], {
    errorMap: () => ({ message: 'Reaction must be "like" or "dislike"' }),
  }),
});

export const submitReactionController = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { commentId } = req.params;
    const validation = submitReactionSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        fields: formatZodError(validation.error),
      });
    }

    const comment = await climbCommentService.getCommentById(commentId);
    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }

    const reaction = await climbReactionService.submitOrUpdateReaction(
      commentId,
      userId,
      validation.data.reaction
    );

    if (reaction === null) {
      return res.status(204).send();
    }

    res.json({ reaction });
  } catch (error) {
    logger.error({ error, commentId: req.params.commentId, userId: req.user?.userId }, "Error submitting reaction");

    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({ error: "Failed to submit reaction" });
  }
};

export const removeReactionController = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { commentId } = req.params;

    await climbReactionService.removeReaction(commentId, userId);

    res.status(204).send();
  } catch (error) {
    logger.error({ error, commentId: req.params.commentId, userId: req.user?.userId }, "Error removing reaction");

    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({ error: "Failed to remove reaction" });
  }
};
