import prisma from "../lib/prisma.js";
import { z } from "zod";

const exerciseSetSchema = z.object({
  order: z.number().int().min(1),
  value: z.number().optional(),
  reps: z.number().optional(),
  restMinutes: z.number().optional(),
});

const workoutSchema = z.object({
  notes: z.string().optional(),
  categoryId: z.string(),
  userId: z.string(),
  exercises: z
    .array(
      z.object({
        type: z.string(),
        name: z.string(),
        unit: z.string().optional(),
        notes: z.string().optional(),
        order: z.number(),
        setsDetail: z.array(exerciseSetSchema).optional(),
      })
    )
    .optional(),
});

const getWorkouts = async (userId) => {
  const workouts = await prisma.workout.findMany({
    where: { userId },
    include: {
      category: true,
      exercises: {
        orderBy: { order: "asc" },
        include: { setsDetail: { orderBy: { order: "asc" } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return workouts;
};

const createWorkout = async (data) => {
  const validatedData = workoutSchema.parse(data);
  const workout = await prisma.workout.create({
    data: {
      notes: validatedData.notes,
      categoryId: validatedData.categoryId,
      userId: validatedData.userId,
      exercises: validatedData.exercises
        ? {
            create: validatedData.exercises.map(({ setsDetail, ...rest }) => ({
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
  const validatedData = workoutSchema.partial().parse(data);

  const workout = await prisma.workout.update({
    where: {
      id: workoutId,
      userId,
    },
    data: {
      ...validatedData,
      exercises: validatedData.exercises
        ? {
            deleteMany: {},
            create: validatedData.exercises.map(({ setsDetail, ...rest }) => ({
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

export {
  createWorkout,
  getWorkouts,
  getWorkoutsByCategory,
  updateWorkout,
  deleteWorkout,
};
