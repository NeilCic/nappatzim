import workoutService from "../services/workoutService.js";

import { z } from "zod";
import logger from "../lib/logger.js";

const exerciseSetSchema = z.object({
  order: z.coerce.number().int().min(1),
  value: z.coerce.number().optional(),
  reps: z.coerce.number().int().min(1, "Reps must be at least 1"),
  restMinutes: z.coerce.number().optional(),
});

const workoutSchema = z.object({
  notes: z.string().optional(),
  categoryId: z.string(),
  exercises: z
    .array(
      z.object({
        type: z.string(),
        name: z.string(),
        unit: z.string().optional(),
        notes: z.string().optional(),
        order: z.coerce.number(),
        setsDetail: z.array(exerciseSetSchema).optional(),
      })
    )
    .min(1, "Workout must have at least one exercise"),
});

const querySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
  sortBy: z.enum(["createdAt", "updatedAt", "id"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  cursor: z.string().optional(),
});

const categoryQuerySchema = z.object({
  includeProgress: z
    .string()
    .optional()
    .transform((val) => val === "true"),
  startDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  endDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
});

const addWorkoutController = async (req, res) => {
  const requestId = Date.now().toString();
  try {
    logger.info(
      { requestId, userId: req.user.userId, categoryId: req.body.categoryId },
      "Creating workout"
    );

    const validatedData = workoutSchema.parse(req.body);
    const workout = await workoutService.createWorkout({
      ...validatedData,
      userId: req.user.userId,
    });

    logger.info({ requestId, workoutId: workout.id }, "Workout created");

    res.status(201).json(workout);
  } catch (error) {
    if (error.name === "ZodError") {
      logger.warn(
        {
          requestId,
          userId: req.user.userId,
          validationError: error,
        },
        "Workout validation failed"
      );
      res.status(400).json({ error: error.message });
    } else {
      logger.error(
        {
          requestId,
          userId: req.user.userId,
          error: error.message,
          stack: error.stack,
          requestBody: req.body,
        },
        "Failed to create workout - server error"
      );
      res.status(500).json({ error: "Internal server error" });
    }
  }
};

const getWorkoutController = async (req, res) => {
  const requestId = Date.now().toString();
  try {
    logger.info(
      { requestId, userId: req.user.userId, query: req.query },
      "Getting workouts"
    );

    const { limit, sortBy, sortOrder, cursor } = querySchema.parse(req.query);
    const result = await workoutService.getWorkouts(req.user.userId, {
      limit,
      sortBy,
      sortOrder,
      cursor,
    });

    logger.info(
      { 
        requestId, 
        userId: req.user.userId, 
        count: result.workouts.length,
        hasMore: result.pagination.hasMore 
      },
      "Workouts retrieved"
    );
    res.json(result);
  } catch (error) {
    if (error.name === "ZodError") {
      logger.warn(
        {
          requestId,
          userId: req.user.userId,
          validationError: error,
        },
        "Workout query validation failed"
      );
      res.status(400).json({ error: error.message });
    } else {
      logger.error(
        {
          requestId,
          userId: req.user.userId,
          error: error.message,
          stack: error.stack,
          query: req.query,
        },
        "Failed to get workouts - server error"
      );
      res.status(500).json({ error: "Internal server error" });
    }
  }
};

const getWorkoutsByCategoryController = async (req, res) => {
  const requestId = Date.now().toString();
  try {
    const { categoryId } = req.params;
    logger.info(
      { requestId, userId: req.user.userId, categoryId, query: req.query },
      "Getting workouts by category"
    );

    const { includeProgress, startDate, endDate } = categoryQuerySchema.parse(
      req.query
    );

    const dateFilter = {};
    if (startDate) {
      dateFilter.createdAt = {
        ...dateFilter.createdAt,
        gte: new Date(startDate),
      };
    }
    if (endDate) {
      dateFilter.createdAt = {
        ...dateFilter.createdAt,
        lte: endDate,
      };
    }

    const workouts = await workoutService.getWorkoutsByCategory(
      req.user.userId,
      categoryId,
      includeProgress,
      dateFilter
    );

    logger.info(
      {
        requestId,
        userId: req.user.userId,
        categoryId,
        count: workouts.length,
      },
      "Workouts by category retrieved"
    );
    res.json(workouts);
  } catch (error) {
    if (error.name === "ZodError") {
      logger.warn(
        {
          requestId,
          userId: req.user.userId,
          categoryId: req.params.categoryId,
          validationError: error,
        },
        "Workout category query validation failed"
      );
      res.status(400).json({ error: error.message });
    } else {
      logger.error(
        {
          requestId,
          userId: req.user.userId,
          categoryId: req.params.categoryId,
          error: error.message,
          stack: error.stack,
          query: req.query,
        },
        "Failed to get workouts by category - server error"
      );
      res.status(500).json({ error: "Internal server error" });
    }
  }
};

const updateWorkoutController = async (req, res) => {
  const requestId = Date.now().toString();
  try {
    const { workoutId } = req.params;
    const { oldCategoryId } = req.body;
    
    if (!oldCategoryId) {
      return res.status(400).json({ error: "oldCategoryId is required" });
    }
    
    logger.info(
      { requestId, userId: req.user.userId, workoutId, requestBody: req.body },
      "Updating workout"
    );

    const validatedData = workoutSchema.partial().parse(req.body);
    const workout = await workoutService.updateWorkout(
      workoutId,
      req.user.userId,
      validatedData,
      oldCategoryId
    );

    logger.info(
      { requestId, userId: req.user.userId, workoutId },
      "Workout updated"
    );
    res.json(workout);
  } catch (error) {
    if (error.name === "ZodError") {
      logger.warn(
        {
          requestId,
          userId: req.user.userId,
          workoutId: req.params.workoutId,
          validationError: error,
        },
        "Workout update validation failed"
      );
      res.status(400).json({ error: error.message });
    } else {
      logger.error(
        {
          requestId,
          userId: req.user.userId,
          workoutId: req.params.workoutId,
          error: error.message,
          stack: error.stack,
          requestBody: req.body,
        },
        "Failed to update workout - server error"
      );
      res.status(500).json({ error: "Internal server error" });
    }
  }
};

const deleteWorkoutController = async (req, res) => {
  const requestId = Date.now().toString();
  try {
    const { workoutId } = req.params;
    const { categoryId } = req.body;
    
    if (!categoryId) {
      return res.status(400).json({ error: "categoryId is required" });
    }
    
    logger.info(
      { requestId, userId: req.user.userId, workoutId, categoryId },
      "Deleting workout"
    );

    await workoutService.deleteWorkout(workoutId, req.user.userId, categoryId);

    logger.info(
      { requestId, userId: req.user.userId, workoutId },
      "Workout deleted"
    );
    res.json({ success: true });
  } catch (error) {
    logger.error(
      {
        requestId,
        userId: req.user.userId,
        workoutId: req.params.workoutId,
        error: error.message,
        stack: error.stack,
      },
      "Failed to delete workout - server error"
    );
    res.status(500).json({ error: "Internal server error" });
  }
};

const hasPreviousWorkoutController = async (req, res) => {
  const requestId = Date.now().toString();
  try {
    const { categoryId } = req.params;
    logger.info(
      { requestId, userId: req.user.userId, categoryId },
      "Checking for previous workout"
    );

    const hasPrevious = await workoutService.hasPreviousWorkout(req.user.userId, categoryId);

    logger.info(
      { requestId, userId: req.user.userId, categoryId, hasPrevious },
      "Checked for previous workout"
    );

    res.json({ hasPrevious });
  } catch (error) {
    logger.error(
      {
        requestId,
        userId: req.user.userId,
        categoryId: req.params.categoryId,
        error: error.message,
        stack: error.stack,
      },
      "Failed to check for previous workout - server error"
    );
    res.status(500).json({ error: "Internal server error" });
  }
};

export {
  addWorkoutController,
  getWorkoutController,
  getWorkoutsByCategoryController,
  updateWorkoutController,
  deleteWorkoutController,
  hasPreviousWorkoutController,
};
