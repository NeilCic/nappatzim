import { Worker } from 'bullmq';
import { createBullMQConnection } from '../lib/queue.js';
import logger from '../lib/logger.js';
import prisma from '../lib/prisma.js';
import { normalizeExerciseName, calculateExerciseStats } from '../lib/exerciseUtils.js';

async function recalculateProgressForCategory(userId, categoryId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { weight: true }
  });
  if (!user) {
    throw new Error("User not found");
  }
  
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
      const stats = calculateExerciseStats(exercise.setsDetail, user.weight);
      
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

export const progressWorker = new Worker(
  'progress-calculation',
  async (job) => {
    const { userId, categoryId } = job.data;
    
    logger.info({ userId, categoryId, jobId: job.id }, 'Processing progress calculation job');
    
    try {
      await recalculateProgressForCategory(userId, categoryId);
      logger.info({ userId, categoryId, jobId: job.id }, 'Progress calculation completed');
      return { success: true, userId, categoryId };
    } catch (error) {
      logger.error({ error, userId, categoryId, jobId: job.id }, 'Progress calculation failed');
      throw error;
    }
  },
  {
    connection: createBullMQConnection(),
    concurrency: 5, 
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
);

progressWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Progress calculation job completed');
});

progressWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err }, 'Progress calculation job failed');
});

progressWorker.on('error', (err) => {
  logger.error({ error: err }, 'Progress worker error');
});

logger.info('Progress worker started');

process.on('SIGTERM', async () => {
  logger.info('Shutting down progress worker...');
  await progressWorker.close();
  process.exit(0);
});

export default progressWorker;

