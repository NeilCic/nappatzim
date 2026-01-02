import PrismaCrudService from "./prismaCrudService.js";
import { WORKOUT_MODEL } from "../lib/dbModels.js";
import prisma from "../lib/prisma.js";
import { decodeCursor, createCursorFromEntity } from "../lib/cursor.js";
import { DEFAULT_PAGINATION_LIMIT } from "../lib/constants.js";
import { normalizeExerciseName, calculateExerciseStats } from "../lib/exerciseUtils.js";

async function updateProgressOnWorkoutCreate(userId, categoryId, workoutDate, exercises, userWeight = 0) {
  const dateString = workoutDate.toISOString();
  
  for (const exercise of exercises) {
    const normalizedName = normalizeExerciseName(exercise.name);
    const stats = calculateExerciseStats(exercise.setsDetail, userWeight);
    
    const workoutEntry = {
      date: dateString,
      volume: stats.totalVolume,
      sets: exercise.setsDetail.length,
      reps: stats.totalReps,
      maxWeight: stats.maxWeight,
      unit: exercise.unit || null
    };
    
    const existing = await prisma.exerciseProgress.findUnique({
      where: {
        userId_categoryId_normalizedName: {
          userId,
          categoryId,
          normalizedName
        }
      }
    });
    
    if (existing) {
      const progress = existing.progress || [];
      progress.push(workoutEntry);
      
      await prisma.exerciseProgress.update({
        where: {
          userId_categoryId_normalizedName: {
            userId,
            categoryId,
            normalizedName
          }
        },
        data: {
          totalVolume: existing.totalVolume + stats.totalVolume,
          totalReps: existing.totalReps + stats.totalReps,
          maxWeight: Math.max(existing.maxWeight, stats.maxWeight),
          progress
        }
      });
    } else {
      await prisma.exerciseProgress.create({
        data: {
          name: exercise.name,
          normalizedName,
          type: exercise.type,
          unit: exercise.unit || null,
          userId,
          categoryId,
          totalVolume: stats.totalVolume,
          totalReps: stats.totalReps,
          maxWeight: stats.maxWeight,
          progress: [workoutEntry]
        }
      });
    }
  }
}

async function updateProgressOnWorkoutDelete(userId, categoryId, workoutDate, exercises, userWeight = 0) {
  const dateString = workoutDate.toISOString();
  
  for (const exercise of exercises) {
    const normalizedName = normalizeExerciseName(exercise.name);
    const stats = calculateExerciseStats(exercise.setsDetail, userWeight);
    
    const existing = await prisma.exerciseProgress.findUnique({
      where: {
        userId_categoryId_normalizedName: {
          userId,
          categoryId,
          normalizedName
        }
      }
    });
    
    if (existing) {
      const progress = (existing.progress || []).filter(
        entry => entry.date !== dateString
      );
      
      const newTotalVolume = Math.max(0, existing.totalVolume - stats.totalVolume);
      const newTotalReps = Math.max(0, existing.totalReps - stats.totalReps);
      
      let newMaxWeight = existing.maxWeight;
      if (stats.maxWeight >= existing.maxWeight) {
        newMaxWeight = progress.length > 0
          ? Math.max(...progress.map(e => e.maxWeight || 0), 0)
          : 0;
      }
      
      if (progress.length === 0 && newTotalVolume === 0 && newTotalReps === 0) {
        await prisma.exerciseProgress.delete({
          where: {
            userId_categoryId_normalizedName: {
              userId,
              categoryId,
              normalizedName
            }
          }
        });
      } else {
        await prisma.exerciseProgress.update({
          where: {
            userId_categoryId_normalizedName: {
              userId,
              categoryId,
              normalizedName
            }
          },
          data: {
            totalVolume: newTotalVolume,
            totalReps: newTotalReps,
            maxWeight: newMaxWeight,
            progress
          }
        });
      }
    }
  }
}

async function updateProgressOnWorkoutUpdate(userId, oldCategoryId, newCategoryId, oldWorkoutDate, newWorkoutDate, oldExercises, newExercises, userWeight = 0) {
  await updateProgressOnWorkoutDelete(userId, oldCategoryId, oldWorkoutDate, oldExercises, userWeight);
  await updateProgressOnWorkoutCreate(userId, newCategoryId, newWorkoutDate, newExercises, userWeight);
}

async function getProgressByCategory(userId, categoryId) {
  return await prisma.exerciseProgress.findMany({
    where: { userId, categoryId },
    orderBy: { name: 'asc' }
  });
}


const workoutInclude = {
  category: true,
  exercises: {
    orderBy: { order: "asc" },
    include: { setsDetail: { orderBy: { order: "asc" } } },
  },
};
const workoutOrderBy = { createdAt: "desc" };

class WorkoutService extends PrismaCrudService {
  constructor() {
    super(WORKOUT_MODEL, workoutInclude, workoutOrderBy);
  }

  async getWorkouts(userId, options = {}) {
    const { 
      limit = DEFAULT_PAGINATION_LIMIT, 
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      cursor 
    } = options;

    const where = { userId };
    
    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) {
        const { sortValue, id } = decoded;
        
        // Build cursor condition based on sort order
        if (sortOrder === 'desc') {
          where.OR = [
            { [sortBy]: { lt: sortValue } },
            {
              AND: [
                { [sortBy]: sortValue },
                { id: { lt: id } }
              ]
            }
          ];
        } else {
          where.OR = [
            { [sortBy]: { gt: sortValue } },
            {
              AND: [
                { [sortBy]: sortValue },
                { id: { gt: id } }
              ]
            }
          ];
        }
      }
    }

    const take = limit + 1;
    const workouts = await prisma.workout.findMany({
      where,
      include: workoutInclude,
      orderBy: [
        { [sortBy]: sortOrder },
        { id: sortOrder }
      ],
      take,
    });

    const hasMore = workouts.length > limit;
    const results = workouts.slice(0, limit);

    let nextCursor = null;
    if (hasMore) {
      const lastWorkout = results[results.length - 1];
      nextCursor = createCursorFromEntity(lastWorkout, sortBy);
    }

    return {
      workouts: results,
      pagination: {
        hasMore,
        nextCursor,
      },
    };
  }

  async createWorkout(data) {
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { weight: true }
    });
    if (!user) {
      throw new Error("User not found");
    }
    const userWeight = user.weight;
    
    const workout = await this.create({
      notes: data.notes,
      categoryId: data.categoryId,
      userId: data.userId,
      exercises: {
        create: data.exercises.map(({ setsDetail, ...rest }) => ({
          ...rest,
          setsDetail: setsDetail?.length
            ? { create: setsDetail }
            : { create: [{ order: 1, reps: 1, value: 0, restMinutes: 1 }] },
        })),
      },
    });
    
    await updateProgressOnWorkoutCreate(
      data.userId,
      data.categoryId,
      workout.createdAt,
      workout.exercises,
      userWeight
    );
    
    return workout;
  }

  async updateWorkout(workoutId, userId, data, oldCategoryId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { weight: true }
    });
    if (!user) {
      throw new Error("User not found");
    }
    const userWeight = user.weight;
    
    const oldWorkout = await this.getOne({ id: workoutId, userId });
    
    const workout = await this.update(
      { id: workoutId, userId },
      {
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
      }
    );
    
    const newCategoryId = data.categoryId || oldCategoryId;
    await updateProgressOnWorkoutUpdate(
      userId,
      oldCategoryId,
      newCategoryId,
      oldWorkout.createdAt,
      workout.createdAt,
      oldWorkout.exercises,
      workout.exercises,
      userWeight
    );
    
    return workout;
  }

  async deleteWorkout(workoutId, userId, categoryId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { weight: true }
    });
    if (!user) {
      throw new Error("User not found");
    }
    const userWeight = user.weight;
    
    const workout = await this.getOne({ id: workoutId, userId });
    
    await this.delete({ id: workoutId, userId });
    
    await updateProgressOnWorkoutDelete(
      userId,
      categoryId,
      workout.createdAt,
      workout.exercises,
      userWeight
    );
    
    return { success: true };
  }

  async getWorkoutsByCategory(userId, categoryId, includeProgress = false, dateFilter = {}) {
    const workouts = await this.getAll({
      where: { userId, categoryId, ...dateFilter },
    });
    
    if (includeProgress) {
      const progressRecords = await getProgressByCategory(userId, categoryId);
      
      const exerciseProgress = {};
      progressRecords.forEach((record) => {
        const key = `${record.name}-${record.type}`;
        exerciseProgress[key] = {
          name: record.name,
          type: record.type,
          progress: record.progress || []
        };
      });
      
      return { workouts, progress: exerciseProgress };
    }
    
    return { workouts, progress: null };
  }

  async hasPreviousWorkout(userId, categoryId) {
    return await this.hasOne({ userId, categoryId });
  }

  async countWorkouts(userId, categoryId) {
    return await this.count({ userId, categoryId });
  }
}

const workoutService = new WorkoutService();

export default workoutService;