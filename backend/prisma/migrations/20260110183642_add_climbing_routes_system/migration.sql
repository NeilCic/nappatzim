/*
  Warnings:

  - You are about to drop the `SpotVideo` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `gradeSystem` to the `Layout` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."SpotVideo" DROP CONSTRAINT "SpotVideo_spotId_fkey";

-- AlterTable
-- First add column as nullable, then set default for existing rows, then make it NOT NULL
ALTER TABLE "public"."Layout" ADD COLUMN     "gradeSystem" TEXT;
UPDATE "public"."Layout" SET "gradeSystem" = 'V-Scale' WHERE "gradeSystem" IS NULL;
ALTER TABLE "public"."Layout" ALTER COLUMN "gradeSystem" SET NOT NULL;

-- DropTable
DROP TABLE "public"."SpotVideo";

-- CreateTable
CREATE TABLE "public"."ClimbVideo" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "videoUrl" TEXT NOT NULL,
    "videoPublicId" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "fileSize" INTEGER NOT NULL,
    "duration" DOUBLE PRECISION,
    "climbId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClimbVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Climb" (
    "id" TEXT NOT NULL,
    "spotId" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "gradeSystem" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "length" DOUBLE PRECISION,
    "setterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Climb_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClimbGradeVote" (
    "id" TEXT NOT NULL,
    "climbId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "gradeSystem" TEXT NOT NULL,
    "height" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClimbGradeVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClimbComment" (
    "id" TEXT NOT NULL,
    "climbId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentCommentId" TEXT,
    "content" TEXT NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "dislikes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),

    CONSTRAINT "ClimbComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClimbCommentReaction" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reaction" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClimbCommentReaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClimbVideo_climbId_idx" ON "public"."ClimbVideo"("climbId");

-- CreateIndex
CREATE INDEX "ClimbVideo_climbId_createdAt_idx" ON "public"."ClimbVideo"("climbId", "createdAt");

-- CreateIndex
CREATE INDEX "Climb_spotId_idx" ON "public"."Climb"("spotId");

-- CreateIndex
CREATE INDEX "Climb_setterId_idx" ON "public"."Climb"("setterId");

-- CreateIndex
CREATE INDEX "Climb_spotId_createdAt_idx" ON "public"."Climb"("spotId", "createdAt");

-- CreateIndex
CREATE INDEX "ClimbGradeVote_climbId_idx" ON "public"."ClimbGradeVote"("climbId");

-- CreateIndex
CREATE INDEX "ClimbGradeVote_userId_idx" ON "public"."ClimbGradeVote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClimbGradeVote_climbId_userId_key" ON "public"."ClimbGradeVote"("climbId", "userId");

-- CreateIndex
CREATE INDEX "ClimbComment_climbId_createdAt_idx" ON "public"."ClimbComment"("climbId", "createdAt");

-- CreateIndex
CREATE INDEX "ClimbComment_userId_idx" ON "public"."ClimbComment"("userId");

-- CreateIndex
CREATE INDEX "ClimbComment_parentCommentId_idx" ON "public"."ClimbComment"("parentCommentId");

-- CreateIndex
CREATE INDEX "ClimbCommentReaction_commentId_idx" ON "public"."ClimbCommentReaction"("commentId");

-- CreateIndex
CREATE INDEX "ClimbCommentReaction_userId_idx" ON "public"."ClimbCommentReaction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClimbCommentReaction_commentId_userId_key" ON "public"."ClimbCommentReaction"("commentId", "userId");

-- AddForeignKey
ALTER TABLE "public"."ClimbVideo" ADD CONSTRAINT "ClimbVideo_climbId_fkey" FOREIGN KEY ("climbId") REFERENCES "public"."Climb"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Climb" ADD CONSTRAINT "Climb_spotId_fkey" FOREIGN KEY ("spotId") REFERENCES "public"."Spot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Climb" ADD CONSTRAINT "Climb_setterId_fkey" FOREIGN KEY ("setterId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClimbGradeVote" ADD CONSTRAINT "ClimbGradeVote_climbId_fkey" FOREIGN KEY ("climbId") REFERENCES "public"."Climb"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClimbGradeVote" ADD CONSTRAINT "ClimbGradeVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClimbComment" ADD CONSTRAINT "ClimbComment_climbId_fkey" FOREIGN KEY ("climbId") REFERENCES "public"."Climb"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClimbComment" ADD CONSTRAINT "ClimbComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClimbComment" ADD CONSTRAINT "ClimbComment_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "public"."ClimbComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClimbCommentReaction" ADD CONSTRAINT "ClimbCommentReaction_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "public"."ClimbComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClimbCommentReaction" ADD CONSTRAINT "ClimbCommentReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
