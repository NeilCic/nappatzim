-- Rename SessionRouteAttempt table to SessionRoute
ALTER TABLE "SessionRouteAttempt" RENAME TO "SessionRoute";

-- Rename indexes
ALTER INDEX "SessionRouteAttempt_sessionId_idx" RENAME TO "SessionRoute_sessionId_idx";
ALTER INDEX "SessionRouteAttempt_climbId_idx" RENAME TO "SessionRoute_climbId_idx";
ALTER INDEX "SessionRouteAttempt_pkey" RENAME TO "SessionRoute_pkey";

-- Rename foreign key constraints
ALTER TABLE "SessionRoute" RENAME CONSTRAINT "SessionRouteAttempt_sessionId_fkey" TO "SessionRoute_sessionId_fkey";
ALTER TABLE "SessionRoute" RENAME CONSTRAINT "SessionRouteAttempt_climbId_fkey" TO "SessionRoute_climbId_fkey";
