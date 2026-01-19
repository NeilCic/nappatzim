/**
 * Script to create test data for session insights testing
 * 
 * Creates:
 * - 1 test user (for voting on climbs)
 * - 1 layout with a placeholder image
 * - 2-3 spots
 * - ~20 climbs per spot with random grades, colors, and descriptors
 * - 1 vote per climb from the test user
 * 
 * Usage: node backend/scripts/createTestData.js
 */

// Load environment variables FIRST, before any imports that use them
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync } from 'fs';
import bcrypt from 'bcryptjs';

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
import spotService from '../services/spotService.js';
import climbVoteService from '../services/climbVoteService.js';

// Colors available for climbs
const COLORS = [
  '#FF6B6B', // Red
  '#5DADE2', // Blue
  '#F7DC6F', // Yellow
  '#8E44AD', // Purple
  '#FF8C00', // Orange
  '#52BE80', // Green
  '#FFB6C1', // Pink
  '#73C6B6', // Turquoise
  '#000000', // Black
  '#808080', // Gray
  '#FFFFFF', // White
];

// Descriptors available
const DESCRIPTORS = [
  'reachy',
  'balance',
  'slopey',
  'crimpy',
  'slippery',
  'static',
  'technical',
  'dyno',
  'coordination',
  'explosive',
  'endurance',
  'powerful',
  'must-try',
  'dangerous',
  'overhang',
  'pockety',
  'dual-tex',
  'compression',
  'campusy',
  'shouldery',
  'slab',
];

// V-Scale grades (V0 to V10)
const V_SCALE_GRADES = Array.from({ length: 11 }, (_, i) => `V${i}`);

async function createTestUser() {
  console.log('👤 Creating test user for voting...');
  
  const email = 'test-voter@nappatzim.test';
  const password = 'test123';
  
  // Check if user already exists
  const existing = await prisma.user.findUnique({
    where: { email }
  });
  
  if (existing) {
    console.log(`   ✓ User already exists: ${email}`);
    return existing;
  }
  
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      username: 'testvoter',
      role: 'user',
    }
  });
  
  console.log(`   ✓ Created user: ${email} (username: ${user.username})`);
  return user;
}

async function getExistingLayout() {
  console.log('\n📐 Selecting existing layout (no Cloudinary uploads)...');

  // Prefer an explicitly named test layout if it exists
  const preferredName = 'Test Gym Layout';

  let layout = await prisma.layout.findFirst({
    where: { name: preferredName },
  });

  if (layout) {
    console.log(`   ✓ Using existing layout by name: ${layout.name}`);
    return layout;
  }

  // Fallback: just take the most recently created layout
  layout = await prisma.layout.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  if (!layout) {
    throw new Error(
      'No layouts found. Please create at least one layout via the app before running this script.'
    );
  }

  console.log(`   ✓ Using latest existing layout: ${layout.name}`);
  return layout;
}

async function createSpots(layout, testUser) {
  console.log('\n📍 Creating spots...');
  
  const spots = [];
  const spotConfigs = [
    { name: 'Main Wall', x: 30, y: 40, color: '#FF6B6B' },
    { name: 'Overhang Section', x: 60, y: 50, color: '#5DADE2' },
    { name: 'Slab Corner', x: 20, y: 70, color: '#52BE80' },
  ];
  
  for (const config of spotConfigs) {
    // Check if spot already exists
    const existing = await prisma.spot.findFirst({
      where: {
        layoutId: layout.id,
        name: config.name
      }
    });
    
    if (existing) {
      console.log(`   ✓ Spot already exists: ${config.name}`);
      spots.push(existing);
      continue;
    }
    
    const spot = await spotService.createSpot({
      name: config.name,
      description: `Test spot: ${config.name}`,
      color: config.color,
      x: config.x,
      y: config.y,
      layoutId: layout.id,
      userId: testUser.id,
    });
    
    console.log(`   ✓ Created spot: ${spot.name}`);
    spots.push(spot);
  }
  
  return spots;
}

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomElements(array, count) {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, array.length));
}

async function createClimbs(spots, testUser) {
  console.log('\n🧗 Creating climbs...');
  
  let totalClimbs = 0;
  
  for (const spot of spots) {
    const climbsPerSpot = 20;
    console.log(`   Creating ${climbsPerSpot} climbs for ${spot.name}...`);
    
    for (let i = 0; i < climbsPerSpot; i++) {
      // Random grade (weighted towards middle grades)
      const gradeIndex = Math.floor(Math.random() * V_SCALE_GRADES.length);
      const grade = V_SCALE_GRADES[gradeIndex];
      
      // Random color
      const color = getRandomElement(COLORS);
      
      // Random length (optional, 3-15 meters)
      const length = Math.random() > 0.3 ? Math.round((Math.random() * 12 + 3) * 10) / 10 : null;
      
      const climb = await prisma.climb.create({
        data: {
          spotId: spot.id,
          grade,
          gradeSystem: 'V-Scale',
          color,
          length,
          setterId: testUser.id,
        }
      });
      
      // Create a vote for this climb
      // Random descriptors (1-4 descriptors)
      const descriptorCount = Math.floor(Math.random() * 4) + 1;
      const descriptors = getRandomElements(DESCRIPTORS, descriptorCount);
      
      // Voter grade might be slightly different from proposed grade
      let voterGrade = grade;
      if (Math.random() > 0.7) {
        // 30% chance to have different voter grade
        const gradeNum = parseInt(grade.replace('V', ''));
        const offset = Math.random() > 0.5 ? 1 : -1;
        const newGradeNum = Math.max(0, Math.min(10, gradeNum + offset));
        voterGrade = `V${newGradeNum}`;
      }
      
      // Random height (optional, 150-200 cm)
      const height = Math.random() > 0.5 ? Math.round(Math.random() * 50 + 150) : null;
      
      await climbVoteService.submitOrUpdateVote(
        climb.id,
        testUser.id,
        voterGrade,
        'V-Scale',
        height,
        descriptors
      );
      
      totalClimbs++;
    }
    
    console.log(`   ✓ Created ${climbsPerSpot} climbs for ${spot.name}`);
  }
  
  console.log(`\n   ✓ Total climbs created: ${totalClimbs}`);
  return totalClimbs;
}

async function main() {
  try {
    console.log('🔄 Starting test data creation...\n');
    
    // Step 1: Create test user
    const testUser = await createTestUser();
    
    // Step 2: Use existing layout (no uploads)
    const layout = await getExistingLayout();
    
    // Step 3: Create spots
    const spots = await createSpots(layout, testUser);
    
    // Step 4: Create climbs with votes
    const totalClimbs = await createClimbs(spots, testUser);
    
    console.log('\n✅ Test data created successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Test user: ${testUser.email} (${testUser.username})`);
    console.log(`   - Layout: ${layout.name}`);
    console.log(`   - Spots: ${spots.length}`);
    console.log(`   - Climbs: ${totalClimbs} (with votes)`);
    console.log(`\n💡 You can now create sessions via the app to test insights!`);
    
  } catch (error) {
    console.error('❌ Error creating test data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
main()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
