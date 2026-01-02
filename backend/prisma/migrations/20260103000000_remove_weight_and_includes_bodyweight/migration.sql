-- Remove weight column from User table
ALTER TABLE "User" DROP COLUMN IF EXISTS "weight";

-- Remove includesBodyweight column from Exercise table
ALTER TABLE "Exercise" DROP COLUMN IF EXISTS "includesBodyweight";

-- Remove includesBodyweight column from ExerciseProgress table
ALTER TABLE "ExerciseProgress" DROP COLUMN IF EXISTS "includesBodyweight";

