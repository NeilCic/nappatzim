import PrismaCrudService from "./prismaCrudService.js";
import { WORKOUT_MODEL } from "../lib/dbModels.js";
import prisma from "../lib/prisma.js";
import { decodeCursor, createCursorFromEntity } from "../lib/cursor.js";
import { DEFAULT_PAGINATION_LIMIT } from "../lib/constants.js";

function normalizeExerciseName(name) {
  return name.toLowerCase().trim();
}

function calculateExerciseStats(setsDetail) {
  return setsDetail.reduce(
    (acc, set) => ({
      totalVolume: acc.totalVolume + (set.reps * (set.value || 1)),
      totalReps: acc.totalReps + set.reps,
      maxWeight: Math.max(acc.maxWeight, set.value || 0)
    }),
    { totalVolume: 0, totalReps: 0, maxWeight: 0 }
  );
}

async function updateProgressOnWorkoutCreate(userId, categoryId, workoutDate, exercises) {
  const dateString = workoutDate.toISOString();
  
  for (const exercise of exercises) {
    const normalizedName = normalizeExerciseName(exercise.name);
    const stats = calculateExerciseStats(exercise.setsDetail);
    
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

async function getProgressByCategory(userId, categoryId) {
  return await prisma.exerciseProgress.findMany({
    where: { userId, categoryId },
    orderBy: { name: 'asc' }
  });
}

async function recalculateProgressForCategory(userId, categoryId) {
  const workouts = await prisma.workout.findMany({
    where: { userId, categoryId },
    include: {
      exercises: {
        include: { setsDetail: true }
      }
    },
    orderBy: { createdAt: 'asc' }
  });
  
  const progressMap = new Map();
  
  for (const workout of workouts) {
    const dateString = workout.createdAt.toISOString();
    
    for (const exercise of workout.exercises) {
      const normalizedName = normalizeExerciseName(exercise.name);
      const stats = calculateExerciseStats(exercise.setsDetail);
      
      const workoutEntry = {
        date: dateString,
        volume: stats.totalVolume,
        sets: exercise.setsDetail.length,
        reps: stats.totalReps,
        maxWeight: stats.maxWeight,
        unit: exercise.unit || null
      };
      
      if (progressMap.has(normalizedName)) {
        const existing = progressMap.get(normalizedName);
        existing.totalVolume += stats.totalVolume;
        existing.totalReps += stats.totalReps;
        existing.maxWeight = Math.max(existing.maxWeight, stats.maxWeight);
        existing.progress.push(workoutEntry);
      } else {
        progressMap.set(normalizedName, {
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
        });
      }
    }
  }
  
  await prisma.$transaction([
    prisma.exerciseProgress.deleteMany({
      where: { userId, categoryId }
    }),
    ...Array.from(progressMap.values()).map(progress =>
      prisma.exerciseProgress.create({ data: progress })
    )
  ]);
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
          // For descending: find records where sortField < cursorValue OR (sortField = cursorValue AND id < cursorId)
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
          // For ascending: find records where sortField > cursorValue OR (sortField = cursorValue AND id > cursorId)
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
      workout.exercises
    );
    
    return workout;
  }

  async updateWorkout(workoutId, userId, data, oldCategoryId) {
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
    
    await recalculateProgressForCategory(userId, oldCategoryId);
    
    if (data.categoryId && data.categoryId !== oldCategoryId) {
      await recalculateProgressForCategory(userId, data.categoryId);
    }
    
    return workout;
  }

  async deleteWorkout(workoutId, userId, categoryId) {
    await this.delete({ id: workoutId, userId });
    await recalculateProgressForCategory(userId, categoryId);
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