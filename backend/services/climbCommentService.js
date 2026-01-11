import PrismaCrudService from "./prismaCrudService.js";
import { CLIMB_COMMENT_MODEL } from "../lib/dbModels.js";
import prisma from "../lib/prisma.js";

class ClimbCommentService extends PrismaCrudService {
  constructor() {
    super(
      CLIMB_COMMENT_MODEL,
      {
        user: { select: { id: true, username: true } },
        parentComment: { include: { user: { select: { id: true, username: true } } } },
        replies: { include: { user: { select: { id: true, username: true } } } },
        reactions: { include: { user: { select: { id: true, username: true } } } },
      },
      { createdAt: "desc" }
    );
  }

  async getCommentsByClimb(climbId, sortBy = "newest") {
    const comments = await this.getAll({
      where: { climbId, parentCommentId: null },
      include: {
        user: { select: { id: true, username: true } },
        replies: {
          include: {
            user: { select: { id: true, username: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: this.getSortOrder(sortBy),
    });

    return comments;
  }

  async getCommentById(commentId) {
    return await this.getOne(
      { id: commentId },
      {
        user: { select: { id: true, username: true } },
        parentComment: { include: { user: { select: { id: true, username: true } } } },
        replies: { include: { user: { select: { id: true, username: true } } } },
      }
    );
  }

  async createComment(climbId, userId, content, parentCommentId = null) {
    if (parentCommentId) {
      const parentComment = await this.getCommentById(parentCommentId);
      if (!parentComment) {
        throw new Error("Parent comment not found");
      }
      if (parentComment.climbId !== climbId) {
        throw new Error("Parent comment must be for the same climb");
      }
      if (parentComment.parentCommentId) {
        throw new Error("Cannot reply to a reply - only one level of nesting allowed");
      }
    }

    return await this.create({
      climbId,
      userId,
      content: content.trim(),
      parentCommentId: parentCommentId || null,
    });
  }

  async updateComment(commentId, userId, content, isAdmin = false) {
    const comment = await this.getCommentById(commentId);
    if (!comment) {
      throw new Error("Comment not found");
    }

    if (comment.userId !== userId && !isAdmin) {
      throw new Error("Unauthorized - can only edit own comments");
    }

    return await prisma.climbComment.update({
      where: { id: commentId },
      data: {
        content: content.trim(),
        editedAt: new Date(),
      },
      include: {
        user: { select: { id: true, username: true } },
        parentComment: { include: { user: { select: { id: true, username: true } } } },
        replies: { include: { user: { select: { id: true, username: true } } } },
      },
    });
  }

  async deleteComment(commentId, userId, isAdmin = false) {
    const comment = await this.getCommentById(commentId);
    if (!comment) {
      throw new Error("Comment not found");
    }

    if (comment.userId !== userId && !isAdmin) {
      throw new Error("Unauthorized - can only delete own comments");
    }

    return await this.delete({ id: commentId });
  }

  getSortOrder(sortBy) {
    switch (sortBy) {
      case "oldest":
        return { createdAt: "asc" };
      case "mostLiked":
        return { likes: "desc" };
      case "newest":
      default:
        return { createdAt: "desc" };
    }
  }
}

const climbCommentService = new ClimbCommentService();

export default climbCommentService;
