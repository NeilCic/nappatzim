import {
  createWorkout,
  getWorkouts,
  getWorkoutsByCategory,
  updateWorkout,
  deleteWorkout,
} from "../services/workoutService.js";

const addWorkoutController = async (req, res) => {
  try {
    const workout = await createWorkout({
      ...req.body,
      userId: req.user.userId,
    });
    res.status(201).json(workout);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getWorkoutController = async (req, res) => {
  try {
    const workouts = await getWorkouts(req.user.userId);
    res.json(workouts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getWorkoutsByCategoryController = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { includeProgress, startDate, endDate } = req.query;

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
        lte: new Date(endDate),
      };
    }

    const workouts = await getWorkoutsByCategory(
      req.user.userId,
      categoryId,
      includeProgress === 'true',
      dateFilter
    );
    res.json(workouts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateWorkoutController = async (req, res) => {
  try {
    const { workoutId } = req.params;
    const workout = await updateWorkout(workoutId, req.user.userId, req.body);
    res.json(workout);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteWorkoutController = async (req, res) => {
  try {
    const { workoutId } = req.params;
    await deleteWorkout(workoutId, req.user.userId);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export {
  addWorkoutController,
  getWorkoutController,
  getWorkoutsByCategoryController,
  updateWorkoutController,
  deleteWorkoutController,
};
