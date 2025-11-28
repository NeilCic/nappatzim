-- CreateTable
CREATE TABLE "public"."ExerciseProgress" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "unit" TEXT,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "totalVolume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalReps" INTEGER NOT NULL DEFAULT 0,
    "maxWeight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "progress" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExerciseProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExerciseProgress_userId_idx" ON "public"."ExerciseProgress"("userId");

-- CreateIndex
CREATE INDEX "ExerciseProgress_categoryId_idx" ON "public"."ExerciseProgress"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseProgress_userId_categoryId_normalizedName_key" ON "public"."ExerciseProgress"("userId", "categoryId", "normalizedName");

-- AddForeignKey
ALTER TABLE "public"."ExerciseProgress" ADD CONSTRAINT "ExerciseProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExerciseProgress" ADD CONSTRAINT "ExerciseProgress_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."WorkoutCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
