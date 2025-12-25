-- CreateTable
CREATE TABLE "public"."Layout" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "layoutImageUrl" TEXT NOT NULL,
    "layoutImagePublicId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Layout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Spot" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "layoutId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Spot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SpotVideo" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "videoUrl" TEXT NOT NULL,
    "videoPublicId" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "fileSize" INTEGER NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "spotId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpotVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Layout_createdAt_idx" ON "public"."Layout"("createdAt");

-- CreateIndex
CREATE INDEX "Spot_layoutId_idx" ON "public"."Spot"("layoutId");

-- CreateIndex
CREATE INDEX "Spot_userId_idx" ON "public"."Spot"("userId");

-- CreateIndex
CREATE INDEX "Spot_layoutId_userId_idx" ON "public"."Spot"("layoutId", "userId");

-- CreateIndex
CREATE INDEX "SpotVideo_spotId_idx" ON "public"."SpotVideo"("spotId");

-- CreateIndex
CREATE INDEX "SpotVideo_spotId_createdAt_idx" ON "public"."SpotVideo"("spotId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."Spot" ADD CONSTRAINT "Spot_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "public"."Layout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Spot" ADD CONSTRAINT "Spot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SpotVideo" ADD CONSTRAINT "SpotVideo_spotId_fkey" FOREIGN KEY ("spotId") REFERENCES "public"."Spot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
