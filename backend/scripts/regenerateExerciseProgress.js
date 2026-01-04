/**
 * Script to regenerate ALL ExerciseProgress records from existing workouts
 * 
 * This script:
 * 1. Deletes all existing ExerciseProgress records
 * 2. Iterates through all workouts (ordered by createdAt)
 * 3. Regenerates ExerciseProgress records for each workout
 * 
 * Usage: node backend/scripts/regenerateExerciseProgress.js
 * 
 * WARNING: This will delete all existing ExerciseProgress records and regenerate them!
 */

// Load environment variables FIRST, before any imports that use them
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try to load .env from backend folder first, then root
const backendEnv = resolve(__dirname, '../.env');
const rootEnv = resolve(__dirname, '../../.env');

if (existsSync(backendEnv)) {
  dotenv.config({ path: backendEnv });
} else if (existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
} else {
  dotenv.config(); // Try default location
}

// Now that env vars are loaded, import modules that depend on them
import prisma from '../lib/prisma.js';
import { normalizeExerciseName, calculateExerciseStats } from '../lib/exerciseUtils.js';

async function regenerateExerciseProgress() {
  try {
    console.log('🔄 Starting ExerciseProgress regeneration...\n');

    // Step 1: Delete all existing ExerciseProgress records
    console.log('🗑️  Deleting all existing ExerciseProgress records...');
    const deletedCount = await prisma.exerciseProgress.deleteMany({});
    console.log(`   ✓ Deleted ${deletedCount.count} existing ExerciseProgress records\n`);

    // Step 2: Fetch all workouts with exercises and sets, ordered by createdAt
    console.log('📥 Fetching all workouts...');
    const workouts = await prisma.workout.findMany({
      include: {
        exercises: {
          orderBy: { order: 'asc' },
          include: {
            setsDetail: {
              orderBy: { order: 'asc' }
            }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
    console.log(`   ✓ Found ${workouts.length} workouts to process\n`);

    if (workouts.length === 0) {
      console.log('✅ No workouts found. ExerciseProgress regeneration complete!');
      return;
    }

    // Step 3: Process each workout and regenerate ExerciseProgress
    console.log('🔄 Regenerating ExerciseProgress records...\n');
    
    let processedWorkouts = 0;
    let processedExercises = 0;
    let createdProgressRecords = 0;
    let updatedProgressRecords = 0;

    for (const workout of workouts) {
      const workoutDate = workout.createdAt;
      const dateString = workoutDate.toISOString();
      // Normalize date to YYYY-MM-DD for comparison (extract date part only)
      const dateOnly = dateString.split('T')[0];
      
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
        
        const existing = await prisma.exerciseProgress.findUnique({
          where: {
            userId_categoryId_normalizedName: {
              userId: workout.userId,
              categoryId: workout.categoryId,
              normalizedName
            }
          }
        });
        
        if (existing) {
          // Update existing record
          const progress = existing.progress || [];
          
          // Check if the last entry is for this date (O(1) since workouts are processed chronologically)
          // Compare only the date part (YYYY-MM-DD), not the full timestamp
          const lastEntry = progress.length > 0 ? progress[progress.length - 1] : null;
          const lastEntryDateOnly = lastEntry?.date ? lastEntry.date.split('T')[0] : null;
          
          if (lastEntry && lastEntryDateOnly === dateOnly) {
            // Combine with existing entry for this date
            progress[progress.length - 1] = {
              date: dateString,
              volume: lastEntry.volume + stats.totalVolume,
              sets: lastEntry.sets + exercise.setsDetail.length,
              reps: lastEntry.reps + stats.totalReps,
              maxWeight: Math.max(lastEntry.maxWeight, stats.maxWeight),
              unit: exercise.unit || lastEntry.unit || null
            };
          } else {
            // Add new entry for this date
            progress.push(workoutEntry);
          }
          
          await prisma.exerciseProgress.update({
            where: {
              userId_categoryId_normalizedName: {
                userId: workout.userId,
                categoryId: workout.categoryId,
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
          updatedProgressRecords++;
        } else {
          // Create new record
          await prisma.exerciseProgress.create({
            data: {
              name: exercise.name,
              normalizedName,
              type: exercise.type,
              unit: exercise.unit || null,
              userId: workout.userId,
              categoryId: workout.categoryId,
              totalVolume: stats.totalVolume,
              totalReps: stats.totalReps,
              maxWeight: stats.maxWeight,
              progress: [workoutEntry]
            }
          });
          createdProgressRecords++;
        }
        
        processedExercises++;
      }
      
      processedWorkouts++;
      
      // Progress update every 10 workouts
      if (processedWorkouts % 10 === 0) {
        console.log(`   Processed ${processedWorkouts}/${workouts.length} workouts...`);
      }
    }

    console.log('\n✅ ExerciseProgress regeneration complete!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Workouts processed: ${processedWorkouts}`);
    console.log(`   - Exercises processed: ${processedExercises}`);
    console.log(`   - New ExerciseProgress records created: ${createdProgressRecords}`);
    console.log(`   - Existing ExerciseProgress records updated: ${updatedProgressRecords}`);
    console.log(`   - Total ExerciseProgress records: ${createdProgressRecords + updatedProgressRecords}`);

    // Step 4: Fetch and display all ExerciseProgress records
    console.log('\n📋 All ExerciseProgress records:');
    const allProgress = await prisma.exerciseProgress.findMany({
      include: {
        user: {
          select: {
            email: true,
            username: true
          }
        },
        category: {
          select: {
            name: true
          }
        }
      },
      orderBy: [
        { userId: 'asc' },
        { categoryId: 'asc' },
        { name: 'asc' }
      ]
    });

    if (allProgress.length === 0) {
      console.log('   No ExerciseProgress records found.');
    } else {
      allProgress.forEach((progress, index) => {
        console.log(`\n   ${index + 1}. ${progress.name} (${progress.type})`);
        console.log(`      User: ${progress.user.email}${progress.user.username ? ` (@${progress.user.username})` : ''}`);
        console.log(`      Category: ${progress.category.name}`);
        console.log(`      Unit: ${progress.unit || 'N/A'}`);
        console.log(`      Total Volume: ${progress.totalVolume}`);
        console.log(`      Total Reps: ${progress.totalReps}`);
        console.log(`      Max Weight: ${progress.maxWeight}`);
        console.log(`      Progress Entries: ${Array.isArray(progress.progress) ? progress.progress.length : 0}`);
        if (Array.isArray(progress.progress) && progress.progress.length > 0) {
          console.log(`      Progress Details:`);
          progress.progress.forEach((entry, idx) => {
            console.log(`        ${idx + 1}. Date: ${entry.date}, Volume: ${entry.volume}, Sets: ${entry.sets}, Reps: ${entry.reps}, MaxWeight: ${entry.maxWeight}`);
          });
        }
      });
    }

  } catch (error) {
    console.error('❌ Error regenerating ExerciseProgress:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
regenerateExerciseProgress()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error.message);
    process.exit(1);
  });

