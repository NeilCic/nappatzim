/*
  Warnings:

  - A unique constraint covering the columns `[climbId,userId]` on the table `ClimbVideo` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ClimbVideo_climbId_userId_key" ON "public"."ClimbVideo"("climbId", "userId");
