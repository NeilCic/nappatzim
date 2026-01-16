import sessionService from "../services/sessionService.js";
import { z } from "zod";
import logger from "../lib/logger.js";
import { formatZodError } from "../lib/zodErrorFormatter.js";

const createSessionSchema = z.object({
  startTime: z.string().datetime().optional().transform((val) => val ? new Date(val) : new Date()),
});

const endSessionSchema = z.object({
  endTime: z.string().datetime().optional().transform((val) => val ? new Date(val) : new Date()),
  notes: z.string().max(1000).optional(),
});

const addRouteAttemptSchema = z.object({
  climbId: z.string().optional(),
  isSuccess: z.boolean(),
  attempts: z.coerce.number().int().min(1),
});

const updateAttemptMetadataSchema = z.object({
  attemptId: z.string(),
});

export const createSessionController = async (req, res) => {
  const requestId = Date.now().toString();
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    logger.info({ requestId, userId }, "Creating session");

    const validatedData = createSessionSchema.parse(req.body);
    const session = await sessionService.createSession(
      userId,
      validatedData.startTime
    );

    logger.info({ requestId, sessionId: session.id }, "Session created");

    res.status(201).json(session);
  } catch (error) {
    if (error.name === "ZodError") {
      logger.warn(
        {
          requestId,
          userId: req.user?.userId,
          validationError: error,
        },
        "Session validation failed"
      );
      const formattedError = formatZodError(error);
      res.status(400).json({ error: formattedError });
    } else {
      logger.error(
        {
          requestId,
          userId: req.user?.userId,
          error: error.message,
          stack: error.stack,
        },
        "Failed to create session"
      );
      res.status(500).json({ error: "Failed to create session" });
    }
  }
};

export const endSessionController = async (req, res) => {
  const requestId = Date.now().toString();
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { sessionId } = req.params;

    logger.info({ requestId, userId, sessionId }, "Ending session");

    const validatedData = endSessionSchema.parse(req.body);
    const session = await sessionService.endSession(
      sessionId,
      validatedData.endTime,
      validatedData.notes
    );

    // Verify user owns the session
    if (session.userId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    logger.info({ requestId, sessionId }, "Session ended");

    res.json(session);
  } catch (error) {
    if (error.name === "ZodError") {
      logger.warn(
        {
          requestId,
          userId: req.user?.userId,
          validationError: error,
        },
        "End session validation failed"
      );
      const formattedError = formatZodError(error);
      res.status(400).json({ error: formattedError });
    } else {
      logger.error(
        {
          requestId,
          userId: req.user?.userId,
          sessionId: req.params.sessionId,
          error: error.message,
          stack: error.stack,
        },
        "Failed to end session"
      );
      res.status(500).json({ error: "Failed to end session" });
    }
  }
};

export const addRouteAttemptController = async (req, res) => {
  const requestId = Date.now().toString();
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { sessionId } = req.params;

    logger.info({ requestId, userId, sessionId }, "Adding route attempt");

    const validatedData = addRouteAttemptSchema.parse(req.body);

    // Verify user owns the session
    const session = await sessionService.getSessionById(sessionId, userId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const attempt = await sessionService.addRouteAttempt(
      sessionId,
      validatedData.climbId || null,
      validatedData.isSuccess,
      validatedData.attempts
    );

    logger.info({ requestId, attemptId: attempt.id }, "Route attempt added");

    res.status(201).json(attempt);
  } catch (error) {
    if (error.name === "ZodError") {
      logger.warn(
        {
          requestId,
          userId: req.user?.userId,
          validationError: error,
        },
        "Add route attempt validation failed"
      );
      const formattedError = formatZodError(error);
      res.status(400).json({ error: formattedError });
    } else if (error.message === "Route already logged in this session") {
      res.status(409).json({ error: error.message });
    } else {
      logger.error(
        {
          requestId,
          userId: req.user?.userId,
          sessionId: req.params.sessionId,
          error: error.message,
          stack: error.stack,
        },
        "Failed to add route attempt"
      );
      res.status(500).json({ error: "Failed to add route attempt" });
    }
  }
};

export const getSessionsController = async (req, res) => {
  const requestId = Date.now().toString();
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
    const cursor = req.query.cursor;

    logger.info({ requestId, userId }, "Fetching sessions");

    const result = await sessionService.getSessionsByUser(userId, {
      limit,
      cursor,
    });

    // Calculate statistics for each session
    const sessionsWithStats = await Promise.all(
      result.sessions.map(async (session) => {
        const stats = await sessionService.getSessionStatistics(session.id);
        return {
          ...session,
          statistics: stats,
        };
      })
    );

    res.json({
      sessions: sessionsWithStats,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    });
  } catch (error) {
    logger.error(
      {
        requestId,
        userId: req.user?.userId,
        error: error.message,
        stack: error.stack,
      },
      "Failed to fetch sessions"
    );
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
};

export const getSessionByIdController = async (req, res) => {
  const requestId = Date.now().toString();
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { sessionId } = req.params;

    logger.info({ requestId, userId, sessionId }, "Fetching session");

    const session = await sessionService.getSessionById(sessionId, userId);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const statistics = await sessionService.getSessionStatistics(sessionId);

    res.json({
      ...session,
      statistics,
    });
  } catch (error) {
    logger.error(
      {
        requestId,
        userId: req.user?.userId,
        sessionId: req.params.sessionId,
        error: error.message,
        stack: error.stack,
      },
      "Failed to fetch session"
    );
    res.status(500).json({ error: "Failed to fetch session" });
  }
};

export const updateAttemptMetadataController = async (req, res) => {
  const requestId = Date.now().toString();
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { attemptId } = req.params;

    logger.info({ requestId, userId, attemptId }, "Updating attempt metadata");

    const attempt = await sessionService.updateAttemptMetadata(attemptId, userId);

    logger.info({ requestId, attemptId }, "Attempt metadata updated");

    res.json(attempt);
  } catch (error) {
    if (error.message === "Route attempt not found or climb no longer exists") {
      res.status(404).json({ error: error.message });
    } else {
      logger.error(
        {
          requestId,
          userId: req.user?.userId,
          attemptId: req.params.attemptId,
          error: error.message,
          stack: error.stack,
        },
        "Failed to update attempt metadata"
      );
      res.status(500).json({ error: "Failed to update attempt metadata" });
    }
  }
};

export const deleteSessionController = async (req, res) => {
  const requestId = Date.now().toString();
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { sessionId } = req.params;

    logger.info({ requestId, userId, sessionId }, "Deleting session");

    await sessionService.deleteSession(sessionId, userId);

    logger.info({ requestId, sessionId }, "Session deleted");

    res.status(204).send();
  } catch (error) {
    if (error.message === "Session not found") {
      res.status(404).json({ error: error.message });
    } else {
      logger.error(
        {
          requestId,
          userId: req.user?.userId,
          sessionId: req.params.sessionId,
          error: error.message,
          stack: error.stack,
        },
        "Failed to delete session"
      );
      res.status(500).json({ error: "Failed to delete session" });
    }
  }
};
