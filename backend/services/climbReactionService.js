import PrismaCrudService from "./prismaCrudService.js";
import { CLIMB_COMMENT_REACTION_MODEL } from "../lib/dbModels.js";
import prisma from "../lib/prisma.js";
import climbCommentService from "./climbCommentService.js";

class ClimbReactionService extends PrismaCrudService {
  constructor() {
    super(CLIMB_COMMENT_REACTION_MODEL, { comment: true, user: { select: { id: true, username: true } } }, { createdAt: "desc" });
  }

  async getReactionByUserAndComment(commentId, userId) {
    return await this.getOne(
      { commentId, userId },
      {
        comment: true,
        user: { select: { id: true, username: true } },
      }
    );
  }

  async submitOrUpdateReaction(commentId, userId, reaction) {
    if (reaction !== "like" && reaction !== "dislike") {
      throw new Error('Reaction must be "like" or "dislike"');
    }

    const existingReaction = await this.getReactionByUserAndComment(commentId, userId);

    const comment = await climbCommentService.getCommentById(commentId);
    if (!comment) {
      throw new Error("Comment not found");
    }

    let likesIncrement = 0;
    let dislikesIncrement = 0;

    if (existingReaction) {
      if (existingReaction.reaction === reaction) {
        await prisma.climbCommentReaction.delete({
          where: {
            commentId_userId: {
              commentId,
              userId,
            },
          },
        });
        
        if (reaction === "like") {
          likesIncrement = -1;
        } else {
          dislikesIncrement = -1;
        }

        await prisma.climbComment.update({
          where: { id: commentId },
          data: {
            likes: { increment: likesIncrement },
            dislikes: { increment: dislikesIncrement },
          },
        });

        return null;
      } else {
        // Changing reaction (like -> dislike or dislike -> like)
        if (existingReaction.reaction === "like") {
          likesIncrement = -1;
          dislikesIncrement = 1;
        } else {
          likesIncrement = 1;
          dislikesIncrement = -1;
        }
      }
    } else {
      // New reaction
      if (reaction === "like") {
        likesIncrement = 1;
      } else {
        dislikesIncrement = 1;
      }
    }

    const updatedReaction = await prisma.climbCommentReaction.upsert({
      where: {
        commentId_userId: {
          commentId,
          userId,
        },
      },
      update: {
        reaction,
      },
      create: {
        commentId,
        userId,
        reaction,
      },
      include: {
        comment: true,
        user: { select: { id: true, username: true } },
      },
    });

    await prisma.climbComment.update({
      where: { id: commentId },
      data: {
        likes: { increment: likesIncrement },
        dislikes: { increment: dislikesIncrement },
      },
    });

    return updatedReaction;
  }

  async removeReaction(commentId, userId) {
    const existingReaction = await this.getReactionByUserAndComment(commentId, userId);
    if (!existingReaction) {
      throw new Error("Reaction not found");
    }

    await prisma.climbCommentReaction.delete({
      where: {
        commentId_userId: {
          commentId,
          userId,
        },
      },
    });

    let likesIncrement = 0;
    let dislikesIncrement = 0;

    if (existingReaction.reaction === "like") {
      likesIncrement = -1;
    } else {
      dislikesIncrement = -1;
    }

    await prisma.climbComment.update({
      where: { id: commentId },
      data: {
        likes: { increment: likesIncrement },
        dislikes: { increment: dislikesIncrement },
      },
    });

    return true;
  }
}

const climbReactionService = new ClimbReactionService();

export default climbReactionService;
