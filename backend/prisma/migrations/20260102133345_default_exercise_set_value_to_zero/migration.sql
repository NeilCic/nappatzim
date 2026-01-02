-- First, update all NULL values to 0
UPDATE "public"."ExerciseSet" SET "value" = 0 WHERE "value" IS NULL;

-- Then make the column required with default
ALTER TABLE "public"."ExerciseSet" ALTER COLUMN "value" SET NOT NULL,
ALTER COLUMN "value" SET DEFAULT 0;
