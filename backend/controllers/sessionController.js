import sessionService from "../services/sessionService.js";
import { z } from "zod";
import logger from "../lib/logger.js";
import { formatZodError } from "../lib/zodErrorFormatter.js";

const MIN_SESSIONS_REQUIRED = 5; // Minimum sessions needed to generate reliable insights

const createSessionSchema = z.object({
  startTime: z.string().datetime().optional().transform((val) => val ? new Date(val) : new Date()),
});

const endSessionSchema = z.object({
  endTime: z.string().datetime().optional().transform((val) => val ? new Date(val) : new Date()),
  notes: z.string().max(1000).optional(),
});

const addRouteSchema = z.object({
  climbId: z.string().optional(),
  isSuccess: z.boolean(),
  attempts: z.coerce.number().int().min(1),
});

const updateRouteSchema = z.object({
  isSuccess: z.boolean().optional(),
  attempts: z.coerce.number().int().min(1).optional(),
});

export const createSessionController = async (req, res) => {
  const requestId = Date.now().toString();
  try {
    const userId = req.user?.userId;
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
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
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
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

export const addRouteController = async (req, res) => {
  const requestId = Date.now().toString();
  try {
    const userId = req.user?.userId;
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { sessionId } = req.params;

    logger.info({ requestId, userId, sessionId }, "Adding route to session");

    const validatedData = addRouteSchema.parse(req.body);

    const session = await sessionService.getSessionById(sessionId, userId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const route = await sessionService.addRoute(
      sessionId,
      validatedData.climbId || null,
      validatedData.isSuccess,
      validatedData.attempts
    );

    logger.info({ requestId, routeId: route.id }, "Route added to session");

    res.status(201).json(route);
  } catch (error) {
    if (error.name === "ZodError") {
      logger.warn(
        {
          requestId,
          userId: req.user?.userId,
          validationError: error,
        },
        "Add route validation failed"
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
        "Failed to add route to session"
      );
      res.status(500).json({ error: "Failed to add route to session" });
    }
  }
};

const sessionsQuerySchema = z.object({
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : undefined)),
  cursor: z.string().optional(),
  startDate: z.string().datetime().optional().transform((val) => (val ? new Date(val) : undefined)),
  endDate: z.string().datetime().optional().transform((val) => (val ? new Date(val) : undefined)),
  minDuration: z.string().optional().transform((val) => (val ? parseInt(val, 10) : undefined)),
  maxDuration: z.string().optional().transform((val) => (val ? parseInt(val, 10) : undefined)),
  minAvgProposedGrade: z.string().optional(),
  maxAvgProposedGrade: z.string().optional(),
  minAvgVoterGrade: z.string().optional(),
  maxAvgVoterGrade: z.string().optional(),
});

export const getSessionsController = async (req, res) => {
  const requestId = Date.now().toString();
  try {
    const userId = req.user?.userId;
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const validatedQuery = sessionsQuerySchema.parse(req.query);

    logger.info({ requestId, userId, filters: validatedQuery }, "Fetching sessions");

    const result = await sessionService.getSessionsByUser(userId, {
      limit: validatedQuery.limit || 20,
      cursor: validatedQuery.cursor,
      includeStatistics: true,
      startDate: validatedQuery.startDate,
      endDate: validatedQuery.endDate,
      minDuration: validatedQuery.minDuration,
      maxDuration: validatedQuery.maxDuration,
      minAvgProposedGrade: validatedQuery.minAvgProposedGrade,
      maxAvgProposedGrade: validatedQuery.maxAvgProposedGrade,
      minAvgVoterGrade: validatedQuery.minAvgVoterGrade,
      maxAvgVoterGrade: validatedQuery.maxAvgVoterGrade,
    });

    res.json({
      sessions: result.sessions,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    });
  } catch (error) {
    if (error.name === "ZodError") {
      logger.warn(
        {
          requestId,
          userId: req.user?.userId,
          validationError: error,
        },
        "Session query validation failed"
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
        "Failed to fetch sessions"
      );
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  }
};

export const getSessionByIdController = async (req, res) => {
  const requestId = Date.now().toString();
  try {
    const userId = req.user?.userId;
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { sessionId } = req.params;

    logger.info({ requestId, userId, sessionId }, "Fetching session");

    const session = await sessionService.getSessionById(sessionId, userId);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.json(session);
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

export const updateRouteController = async (req, res) => {
  const requestId = Date.now().toString();
  try {
    const userId = req.user?.userId;
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { routeId } = req.params;

    logger.info({ requestId, userId, routeId }, "Updating route");

    const validatedData = updateRouteSchema.parse(req.body);
    const route = await sessionService.updateRoute(routeId, userId, validatedData);

    logger.info({ requestId, routeId }, "Route updated");

    res.json(route);
  } catch (error) {
    if (error.name === "ZodError") {
      logger.warn(
        {
          requestId,
          userId: req.user?.userId,
          validationError: error,
        },
        "Update route validation failed"
      );
      const formattedError = formatZodError(error);
      res.status(400).json({ error: formattedError });
    } else if (error.message === "Route not found") {
      res.status(404).json({ error: error.message });
    } else {
      logger.error(
        {
          requestId,
          userId: req.user?.userId,
          routeId: req.params.routeId,
          error: error.message,
          stack: error.stack,
        },
        "Failed to update route"
      );
      res.status(500).json({ error: "Failed to update route" });
    }
  }
};

export const updateRouteMetadataController = async (req, res) => {
  const requestId = Date.now().toString();
  try {
    const userId = req.user?.userId;
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { routeId } = req.params;

    logger.info({ requestId, userId, routeId }, "Updating route metadata");

    const route = await sessionService.updateRouteMetadata(routeId, userId);

    logger.info({ requestId, routeId }, "Route metadata updated");

    res.json(route);
  } catch (error) {
    if (error.message === "Route not found or climb no longer exists") {
      res.status(404).json({ error: error.message });
    } else {
      logger.error(
        {
          requestId,
          userId: req.user?.userId,
          routeId: req.params.routeId,
          error: error.message,
          stack: error.stack,
        },
        "Failed to update route metadata"
      );
      res.status(500).json({ error: "Failed to update route metadata" });
    }
  }
};

export const getLoggedClimbIdsController = async (req, res) => {
  const requestId = Date.now().toString();
  try {
    const userId = req.user?.userId;
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return res.status(401).json({ error: "Unauthorized" });
    }

    logger.info({ requestId, userId }, "Fetching logged climb IDs");

    const climbIds = await sessionService.getLoggedClimbIds(userId);

    res.json({ climbIds });
  } catch (error) {
    logger.error(
      {
        requestId,
        userId: req.user?.userId,
        error: error.message,
        stack: error.stack,
      },
      "Failed to fetch logged climb IDs"
    );
    res.status(500).json({ error: "Failed to fetch logged climb IDs" });
  }
};

export const getGradeProfileController = async (req, res) => {
  const requestId = Date.now().toString();
  try {
    const userId = req.user?.userId;
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return res.status(401).json({ error: "Unauthorized" });
    }

    logger.info({ requestId, userId }, "Getting grade profile");

    // Parse minSessions from query param if provided, otherwise use default minimum
    // More sessions = more reliable data, but we require at least MIN_SESSIONS_REQUIRED
    const minSessions = req.query.minSessions 
      ? parseInt(req.query.minSessions, 10) 
      : MIN_SESSIONS_REQUIRED;

    const gradeProfile = await sessionService.calculateGradeProfile(userId, {
      minSessions: Math.max(minSessions, MIN_SESSIONS_REQUIRED), // Ensure at least minimum
    });

    logger.info({ requestId, hasEnoughData: gradeProfile.hasEnoughData }, "Grade profile calculated");

    res.status(200).json(gradeProfile);
  } catch (error) {
    logger.error(
      {
        requestId,
        userId: req.user?.userId,
        error: error.message,
        stack: error.stack,
      },
      "Failed to get grade profile"
    );
    res.status(500).json({ error: "Failed to get grade profile" });
  }
};

export const deleteSessionController = async (req, res) => {
  const requestId = Date.now().toString();
  try {
    const userId = req.user?.userId;
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
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
