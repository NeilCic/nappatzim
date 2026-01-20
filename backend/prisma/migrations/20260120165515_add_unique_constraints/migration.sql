/*
  Warnings:

  - You are about to alter the column `name` on the `Spot` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - A unique constraint covering the columns `[sessionId,climbId]` on the table `SessionRoute` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[layoutId,name]` on the table `Spot` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,name]` on the table `WorkoutCategory` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."WorkoutCategory_userId_name_idx";

-- AlterTable
ALTER TABLE "public"."Spot" ALTER COLUMN "name" SET DATA TYPE VARCHAR(20);

-- CreateIndex
CREATE UNIQUE INDEX "SessionRoute_sessionId_climbId_key" ON "public"."SessionRoute"("sessionId", "climbId");

-- CreateIndex
CREATE UNIQUE INDEX "Spot_layoutId_name_key" ON "public"."Spot"("layoutId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutCategory_userId_name_key" ON "public"."WorkoutCategory"("userId", "name");
