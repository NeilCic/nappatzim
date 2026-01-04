/**
 * Script to create test workouts for graph testing
 * 
 * Creates 10 workouts with:
 * - Pull ups (no weight, gradually increasing sets/reps)
 * - Deadlifts (with weight, gradually increasing weight)
 * 
 * Dates are spread over the last month with some duplicates to test aggregation
 * 
 * Usage: node backend/scripts/createTestWorkouts.js
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
import workoutService from '../services/workoutService.js';
import { normalizeExerciseName, calculateExerciseStats } from '../lib/exerciseUtils.js';

async function createTestWorkouts() {
  try {
    console.log('🔄 Starting test workout creation...\n');

    // Step 1: Get the user (Neil)
    console.log('👤 Fetching user...');
    const user = await prisma.user.findFirst({
      where: { email: { contains: 'neil', mode: 'insensitive' } }
    });

    if (!user) {
      console.error('❌ User not found!');
      process.exit(1);
    }
    console.log(`   ✓ Found user: ${user.email} (${user.username || 'no username'})\n`);

    // Step 2: Get the "Script" category
    console.log('📁 Fetching "Script" category...');
    const category = await prisma.workoutCategory.findFirst({
      where: {
        userId: user.id,
        name: { equals: 'Script', mode: 'insensitive' }
      }
    });

    if (!category) {
      console.error('❌ "Script" category not found!');
      process.exit(1);
    }
    console.log(`   ✓ Found category: ${category.name}\n`);

    // Step 3: Generate dates over the last month with some duplicates
    console.log('📅 Generating dates...');
    const dates = [];
    const today = new Date();
    
    // Generate 20 dates, some duplicates
    // Dates: spread over last 30 days, with some on same days
    const daysAgoPattern = [
      28, // Day 28 (oldest)
      27, // Day 27
      25, // Day 25
      25, // Day 25 (duplicate - same date)
      24, // Day 24
      22, // Day 22
      20, // Day 20
      20, // Day 20 (duplicate - same date)
      18, // Day 18
      16, // Day 16
      15, // Day 15
      15, // Day 15 (duplicate - same date)
      13, // Day 13
      11, // Day 11
      10, // Day 10
      8,  // Day 8
      7,  // Day 7
      5,  // Day 5
      3,  // Day 3
      0   // Day 0 (today/newest)
    ];

    for (let i = 0; i < 20; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - daysAgoPattern[i]);
      // Add some random hours to make them different timestamps but same dates for duplicates
      date.setHours(8 + Math.floor(Math.random() * 12));
      date.setMinutes(Math.floor(Math.random() * 60));
      date.setSeconds(Math.floor(Math.random() * 60));
      dates.push(date);
    }

    console.log(`   ✓ Generated ${dates.length} dates\n`);

    // Step 4: Define progressions
    // Pull ups: Progressive from 1x3 to 4x6, then continue
    const pullupProgression = [
      { sets: 1, reps: 3 },
      { sets: 1, reps: 4 },
      { sets: 2, reps: 3 },
      { sets: 2, reps: 4 },
      { sets: 2, reps: 5 },
      { sets: 3, reps: 4 },
      { sets: 3, reps: 5 },
      { sets: 3, reps: 6 },
      { sets: 4, reps: 5 },
      { sets: 4, reps: 6 },
      { sets: 4, reps: 7 },
      { sets: 5, reps: 5 },
      { sets: 5, reps: 6 },
      { sets: 5, reps: 7 },
      { sets: 6, reps: 5 },
      { sets: 6, reps: 6 },
      { sets: 6, reps: 7 },
      { sets: 7, reps: 5 },
      { sets: 7, reps: 6 },
      { sets: 8, reps: 5 },
    ];

    // Deadlifts: 3 sets of 5, weight increases with tapering: 60kg → 110kg, then continue
    const deadliftWeights = [
      60, 65, 70, 75, 80, 85, 87.5, 90, 92.5, 95,
      97.5, 100, 102.5, 105, 107.5, 110, 112.5, 115, 117.5, 120
    ];

    // Step 5: Create workouts
    console.log('💪 Creating workouts...\n');
    
    for (let i = 0; i < 20; i++) {
      const pullup = pullupProgression[i];
      const deadliftWeight = deadliftWeights[i];
      const workoutDate = dates[i];

      // Create pullup sets (no weight, value = 0)
      const pullupSets = [];
      for (let s = 0; s < pullup.sets; s++) {
        pullupSets.push({
          order: s + 1,
          value: 0, // No weight for pullups
          reps: pullup.reps,
          restMinutes: 2
        });
      }

      // Create deadlift sets (3 sets of 5 reps)
      const deadliftSets = [];
      for (let s = 0; s < 3; s++) {
        deadliftSets.push({
          order: s + 1,
          value: deadliftWeight,
          reps: 5,
          restMinutes: 3
        });
      }

      const workoutData = {
        categoryId: category.id,
        userId: user.id,
        notes: `Test workout ${i + 1}`,
        exercises: [
          {
            type: 'weight',
            name: 'Pullups',
            unit: null, // No unit for bodyweight
            order: 1,
            setsDetail: pullupSets
          },
          {
            type: 'weight',
            name: 'Deadlifts',
            unit: 'kg',
            order: 2,
            setsDetail: deadliftSets
          }
        ]
      };

      // Create workout using workoutService (this automatically creates progress)
      const workout = await workoutService.createWorkout(workoutData);
      
      // Update the workout using the system API to test update functionality
      // This will trigger updateProgressOnWorkoutUpdate
      await workoutService.updateWorkout(
        workout.id,
        user.id,
        {
          notes: workoutData.notes,
          categoryId: category.id,
          exercises: workoutData.exercises
        },
        category.id
      );
      
      // Now update the workout's createdAt to our desired date
      // Note: updateWorkout doesn't handle createdAt, so we update it directly
      // We'll need to manually fix the progress dates afterward
      await prisma.workout.update({
        where: { id: workout.id },
        data: { createdAt: workoutDate }
      });
      
      // Manually fix progress dates to match the new createdAt
      // This uses the same logic as the system would use
      const correctDateString = workoutDate.toISOString();
      const correctDateOnly = correctDateString.split('T')[0];
      
      // Fetch the updated workout with exercises
      const updatedWorkout = await prisma.workout.findUnique({
        where: { id: workout.id },
        include: {
          exercises: {
            include: {
              setsDetail: true
            }
          }
        }
      });
      
      for (const exercise of updatedWorkout.exercises) {
        const normalizedName = normalizeExerciseName(exercise.name);
        const stats = calculateExerciseStats(exercise.setsDetail);
        
        const workoutEntry = {
          date: correctDateString,
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
              normalizedName: normalizedName
            }
          }
        });
        
        if (existing) {
          // Remove the most recent entry (created by updateWorkout with wrong date)
          // and add one with correct date
          const progress = existing.progress || [];
          progress.pop(); // Remove last entry (the one with wrong date)
          
          // Add entry with correct date using same logic as system
          const lastEntry = progress.length > 0 ? progress[progress.length - 1] : null;
          const lastEntryDateOnly = lastEntry?.date ? lastEntry.date.split('T')[0] : null;
          
          if (lastEntry && lastEntryDateOnly === correctDateOnly) {
            // Combine with existing entry for this date
            progress[progress.length - 1] = {
              date: correctDateString,
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
          
          // Recalculate totals from all progress entries
          const newTotalVolume = progress.reduce((sum, entry) => sum + (entry.volume || 0), 0);
          const newTotalReps = progress.reduce((sum, entry) => sum + (entry.reps || 0), 0);
          const newMaxWeight = Math.max(...progress.map(e => e.maxWeight || 0), 0);
          
          await prisma.exerciseProgress.update({
            where: {
              userId_categoryId_normalizedName: {
                userId: workout.userId,
                categoryId: workout.categoryId,
                normalizedName: normalizedName
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

      console.log(`   ✓ Created workout ${i + 1}/20`);
      console.log(`      Date: ${workoutDate.toISOString().split('T')[0]}`);
      console.log(`      Pullups: ${pullup.sets}x${pullup.reps}`);
      console.log(`      Deadlifts: 3x5 @ ${deadliftWeight}kg\n`);
    }

    console.log('✅ Test workouts created successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Workouts created: 20`);
    console.log(`   - Category: ${category.name}`);
    console.log(`   - User: ${user.email}`);
    console.log(`   - Dates: Spread over last month with some duplicates`);

  } catch (error) {
    console.error('❌ Error creating test workouts:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createTestWorkouts()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error.message);
    process.exit(1);
  });

