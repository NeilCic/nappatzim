import PrismaCrudService from "./prismaCrudService.js";
import prisma from "../lib/prisma.js";
import { USER_MODEL, CONVERSATION_MODEL } from "../lib/dbModels.js";

async function assertUserInConversation(userId, conversationId) {
  const participant = await prisma.conversationParticipant.findFirst({
    where: {
      conversationId,
      userId,
    },
  });

  if (!participant) {
    throw new Error("Not a participant in this conversation");
  }
}

class ChatService extends PrismaCrudService {
  constructor() {
    super(CONVERSATION_MODEL);
  }

  async getOrCreateDmConversation(userId, peerUserId) {
    if (userId === peerUserId) {
      throw new Error("Cannot create a DM with yourself");
    }

    const existing = await this.getOne(
      {
        participants: {
          every: {
            userId: { in: [userId, peerUserId] },
          },
        },
      },
      { participants: true }
    );

    if (existing && existing.participants.length === 2) {
      return existing;
    }

    // todo - not happy with using prisma directly
    const peer = await prisma[USER_MODEL].findUnique({
      where: { id: peerUserId },
      select: { id: true },
    });
    if (!peer) {
      throw new Error("Peer user not found");
    }

    const conversation = await this.create(
      {
        participants: {
          create: [
            { userId },
            { userId: peerUserId },
          ],
        },
      },
      { participants: true }
    );

    return conversation;
  }

  async getOrCreateDmConversationByUsername(userId, peerUsername) {
    // Look up user by username first
    const peer = await prisma[USER_MODEL].findUnique({
      where: { username: peerUsername },
      select: { id: true },
    });
    
    if (!peer) {
      throw new Error("User not found");
    }

    // Use the existing method with the userId
    return this.getOrCreateDmConversation(userId, peer.id);
  }

  async listConversationsForUser(userId) {
    const conversations = await this.getAll({
      where: {
        participants: {
          some: { userId },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    return conversations;
  }

  async listMessages(userId, conversationId, { limit = 50, before } = {}) {
    await assertUserInConversation(userId, conversationId);

    const where = { conversationId };
    if (before) {
      where.createdAt = { lt: before };
    }

    const messages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return messages;
  }

  async sendMessage(userId, conversationId, content) {
    if (!content || !content.trim()) {
      throw new Error("Message content is required");
    }

    await assertUserInConversation(userId, conversationId);

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        content: content.trim(),
      },
    });

    await this.update(
      { id: conversationId },
      { updatedAt: new Date() }
    );

    return message;
  }

  async markReadUpTo(userId, conversationId, upTo) {
    await assertUserInConversation(userId, conversationId);

    const cutoff = upTo || new Date();

    await prisma.message.updateMany({
      where: {
        conversationId,
        createdAt: { lte: cutoff },
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });
  }
}

const chatService = new ChatService();

export default chatService;


