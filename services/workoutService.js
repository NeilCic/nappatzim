import prisma from "../lib/prisma.js";

const getWorkouts = async (userId, options = {}) => {
  const { limit, sortBy = 'createdAt', sortOrder = 'desc' } = options;

  const workouts = await prisma.workout.findMany({
    where: { userId },
    include: {
      category: true,
      exercises: {
        orderBy: { order: "asc" },
        include: { setsDetail: { orderBy: { order: "asc" } } },
      },
    },
    orderBy: { [sortBy]: sortOrder },
    ...(limit && { take: parseInt(limit, 10) }),
  });
  return workouts;
};

const createWorkout = async (data) => {
  const workout = await prisma.workout.create({
    data: {
      notes: data.notes,
      categoryId: data.categoryId,
      userId: data.userId,
      exercises: data.exercises
        ? {
            create: data.exercises.map(({ setsDetail, ...rest }) => ({
              ...rest,
              setsDetail: setsDetail?.length
                ? { create: setsDetail }
                : { create: [{ order: 1, reps: 1, value: 0, restMinutes: 1 }] },
            })),
          }
        : undefined,
    },
    include: {
      category: true,
      exercises: {
        orderBy: { order: "asc" },
        include: { setsDetail: { orderBy: { order: "asc" } } },
      },
    },
  });

  return workout;
};

const getWorkoutsByCategory = async (
  userId,
  categoryId,
  includeProgress = false,
  dateFilter = {}
) => {
  const workouts = await prisma.workout.findMany({
    where: {
      userId,
      categoryId,
      ...dateFilter,
    },
    include: {
      category: true,
      exercises: {
        orderBy: { order: "asc" },
        include: { setsDetail: { orderBy: { order: "asc" } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (includeProgress) {
    const exerciseProgress = {};

    workouts.forEach((workout) => {
      workout.exercises.forEach((exercise) => {
        const key = `${exercise.name}-${exercise.type}`;
        const totalVolume = exercise.setsDetail.reduce((total, set) => {
          return total + (set.reps || 1) * (set.value || 1);
        }, 0);

        if (!exerciseProgress[key]) {
          exerciseProgress[key] = {
            name: exercise.name,
            type: exercise.type,
            progress: [],
          };
        }

        exerciseProgress[key].progress.push({
          date: workout.createdAt,
          volume: totalVolume,
          sets: exercise.setsDetail.length,
          reps: exercise.setsDetail.reduce(
            (sum, set) => sum + (set.reps || 0),
            0
          ),
          maxWeight: Math.max(
            ...exercise.setsDetail.map((set) => set.value || 0)
          ), 
          unit: exercise.unit,
        });
      });
    });

    return { workouts, progress: exerciseProgress };
  }

  return { workouts, progress: null };
};

const updateWorkout = async (workoutId, userId, data) => {
  const workout = await prisma.workout.update({
    where: {
      id: workoutId,
      userId,
    },
    data: {
      ...data,
      exercises: data.exercises
        ? {
            deleteMany: {},
            create: data.exercises.map(({ setsDetail, ...rest }) => ({
              ...rest,
              setsDetail: setsDetail?.length
                ? { create: setsDetail }
                : { create: [{ order: 1, reps: 1, value: 0, restMinutes: 1 }] },
            })),
          }
        : undefined,
    },
    include: {
      category: true,
      exercises: {
        orderBy: { order: "asc" },
        include: { setsDetail: { orderBy: { order: "asc" } } },
      },
    },
  });

  return workout;
};

const deleteWorkout = async (workoutId, userId) => {
  await prisma.workout.delete({
    where: {
      id: workoutId,
      userId,
    },
  });

  return { success: true };
};

const hasPreviousWorkout = async (userId, categoryId) => {
  const count = await prisma.workout.count({
    where: {
      userId,
      categoryId,
    },
  });
  return count > 0;
};

export {
  createWorkout,
  getWorkouts,
  getWorkoutsByCategory,
  updateWorkout,
  deleteWorkout,
  hasPreviousWorkout,
};
