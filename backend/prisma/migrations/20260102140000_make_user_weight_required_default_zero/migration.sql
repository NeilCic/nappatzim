-- First, update all NULL weight values to 0
UPDATE "public"."User" SET "weight" = 0 WHERE "weight" IS NULL;

-- Then make the column required with default
ALTER TABLE "public"."User" ALTER COLUMN "weight" SET NOT NULL,
ALTER COLUMN "weight" SET DEFAULT 0;

