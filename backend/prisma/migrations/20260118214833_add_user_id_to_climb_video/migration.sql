-- Add userId column to ClimbVideo table
-- First add as nullable to allow migration of existing records
ALTER TABLE "public"."ClimbVideo" ADD COLUMN "userId" TEXT;

-- For existing videos, we need to assign them to a user
-- Since videos belong to climbs, and climbs belong to spots, we can assign them to the spot owner
-- Update existing videos to belong to the spot owner of their climb
UPDATE "public"."ClimbVideo" cv
SET "userId" = (
  SELECT s."userId"
  FROM "public"."Climb" c
  JOIN "public"."Spot" s ON c."spotId" = s."id"
  WHERE c."id" = cv."climbId"
)
WHERE cv."userId" IS NULL;

-- If any videos still don't have a userId (edge case: climb/spot was deleted), delete them
-- They would be orphaned anyway
DELETE FROM "public"."ClimbVideo" WHERE "userId" IS NULL;

-- Now make the column required (NOT NULL)
ALTER TABLE "public"."ClimbVideo" ALTER COLUMN "userId" SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE "public"."ClimbVideo" ADD CONSTRAINT "ClimbVideo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add index on userId for performance
CREATE INDEX "ClimbVideo_userId_idx" ON "public"."ClimbVideo"("userId");
