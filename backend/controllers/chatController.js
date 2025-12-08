import { z } from "zod";
import chatService from "../services/chatService.js";
import logger from "../lib/logger.js";

const createDmSchema = z.object({
  peerUsername: z.string().min(1, "Username is required"),
});

const listMessagesQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
  before: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
});

const sendMessageSchema = z.object({
  content: z.string().min(1, "Message content is required"),
});

const markReadSchema = z.object({
  upTo: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
});

const createDmConversationController = async (req, res) => {
  const requestId = Date.now().toString();
  try {
    const validated = createDmSchema.parse(req.body);

    logger.info(
      { requestId, userId: req.user.userId, peerUsername: validated.peerUsername },
      "Creating or fetching DM conversation"
    );

    const conversation = await chatService.getOrCreateDmConversationByUsername(
      req.user.userId,
      validated.peerUsername
    );

    res.status(201).json(conversation);
  } catch (error) {
    if (error.name === "ZodError") {
      logger.warn(
        {
          requestId,
          userId: req.user.userId,
          validationError: error,
        },
        "DM creation validation failed"
      );
      return res.status(400).json({ error: error.message });
    }

    logger.error(
      {
        requestId,
        userId: req.user.userId,
        error: error.message,
        stack: error.stack,
      },
      "Failed to create or fetch DM conversation"
    );
    res.status(500).json({ error: "Internal server error" });
  }
};

const listConversationsController = async (req, res) => {
  const requestId = Date.now().toString();
  try {
    logger.info(
      { requestId, userId: req.user.userId },
      "Listing conversations for user"
    );

    const conversations = await chatService.listConversationsForUser(
      req.user.userId
    );

    logger.info(
      {
        requestId,
        userId: req.user.userId,
        count: conversations.length,
      },
      "Conversations retrieved"
    );

    res.json(conversations);
  } catch (error) {
    logger.error(
      {
        requestId,
        userId: req.user.userId,
        error: error.message,
        stack: error.stack,
      },
      "Failed to list conversations"
    );
    res.status(500).json({ error: "Internal server error" });
  }
};

const listMessagesController = async (req, res) => {
  const requestId = Date.now().toString();
  try {
    const { conversationId } = req.params;

    logger.info(
      {
        requestId,
        userId: req.user.userId,
        conversationId,
        query: req.query,
      },
      "Listing messages for conversation"
    );

    const { limit, before } = listMessagesQuerySchema.parse(req.query);

    const messages = await chatService.listMessages(
      req.user.userId,
      conversationId,
      { limit, before }
    );

    logger.info(
      {
        requestId,
        userId: req.user.userId,
        conversationId,
        count: messages.length,
      },
      "Messages retrieved"
    );

    res.json(messages);
  } catch (error) {
    if (error.name === "ZodError") {
      logger.warn(
        {
          requestId,
          userId: req.user.userId,
          conversationId: req.params.conversationId,
          validationError: error,
        },
        "Message list query validation failed"
      );
      return res.status(400).json({ error: error.message });
    }

    logger.error(
      {
        requestId,
        userId: req.user.userId,
        conversationId: req.params.conversationId,
        error: error.message,
        stack: error.stack,
      },
      "Failed to list messages"
    );
    res.status(500).json({ error: "Internal server error" });
  }
};

const sendMessageController = async (req, res) => {
  const requestId = Date.now().toString();
  try {
    const { conversationId } = req.params;
    const { content } = sendMessageSchema.parse(req.body);

    logger.info(
      {
        requestId,
        userId: req.user.userId,
        conversationId,
      },
      "Sending message"
    );

    const message = await chatService.sendMessage(
      req.user.userId,
      conversationId,
      content
    );

    logger.info(
      {
        requestId,
        userId: req.user.userId,
        conversationId,
        messageId: message.id,
      },
      "Message sent"
    );

    res.status(201).json(message);
  } catch (error) {
    if (error.name === "ZodError") {
      logger.warn(
        {
          requestId,
          userId: req.user.userId,
          conversationId: req.params.conversationId,
          validationError: error,
        },
        "Send message validation failed"
      );
      return res.status(400).json({ error: error.message });
    }

    if (error.message === "Not a participant in this conversation") {
      logger.warn(
        {
          requestId,
          userId: req.user.userId,
          conversationId: req.params.conversationId,
        },
        "Unauthorized send attempt for conversation"
      );
      return res.status(403).json({ error: error.message });
    }

    logger.error(
      {
        requestId,
        userId: req.user.userId,
        conversationId: req.params.conversationId,
        error: error.message,
        stack: error.stack,
      },
      "Failed to send message"
    );
    res.status(500).json({ error: "Internal server error" });
  }
};

const markReadController = async (req, res) => {
  const requestId = Date.now().toString();
  try {
    const { conversationId } = req.params;
    const { upTo } = markReadSchema.parse(req.body);

    logger.info(
      {
        requestId,
        userId: req.user.userId,
        conversationId,
      },
      "Marking messages as read"
    );

    await chatService.markReadUpTo(req.user.userId, conversationId, upTo);

    res.json({ success: true });
  } catch (error) {
    if (error.name === "ZodError") {
      logger.warn(
        {
          requestId,
          userId: req.user.userId,
          conversationId: req.params.conversationId,
          validationError: error,
        },
        "Mark read validation failed"
      );
      return res.status(400).json({ error: error.message });
    }

    if (error.message === "Not a participant in this conversation") {
      logger.warn(
        {
          requestId,
          userId: req.user.userId,
          conversationId: req.params.conversationId,
        },
        "Unauthorized mark-read attempt for conversation"
      );
      return res.status(403).json({ error: error.message });
    }

    logger.error(
      {
        requestId,
        userId: req.user.userId,
        conversationId: req.params.conversationId,
        error: error.message,
        stack: error.stack,
      },
      "Failed to mark messages as read"
    );
    res.status(500).json({ error: "Internal server error" });
  }
};

export {
  createDmConversationController,
  listConversationsController,
  listMessagesController,
  sendMessageController,
  markReadController,
};


