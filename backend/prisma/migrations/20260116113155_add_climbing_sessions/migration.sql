-- CreateTable
CREATE TABLE "public"."ClimbingSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClimbingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SessionRouteAttempt" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "climbId" TEXT,
    "proposedGrade" TEXT NOT NULL,
    "gradeSystem" TEXT NOT NULL,
    "voterGrade" TEXT,
    "descriptors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionRouteAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClimbingSession_userId_createdAt_idx" ON "public"."ClimbingSession"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ClimbingSession_userId_idx" ON "public"."ClimbingSession"("userId");

-- CreateIndex
CREATE INDEX "SessionRouteAttempt_sessionId_idx" ON "public"."SessionRouteAttempt"("sessionId");

-- CreateIndex
CREATE INDEX "SessionRouteAttempt_climbId_idx" ON "public"."SessionRouteAttempt"("climbId");

-- AddForeignKey
ALTER TABLE "public"."ClimbingSession" ADD CONSTRAINT "ClimbingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SessionRouteAttempt" ADD CONSTRAINT "SessionRouteAttempt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."ClimbingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SessionRouteAttempt" ADD CONSTRAINT "SessionRouteAttempt_climbId_fkey" FOREIGN KEY ("climbId") REFERENCES "public"."Climb"("id") ON DELETE SET NULL ON UPDATE CASCADE;
