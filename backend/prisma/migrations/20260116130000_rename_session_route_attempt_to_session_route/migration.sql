-- Rename SessionRouteAttempt table to SessionRoute
ALTER TABLE "SessionRouteAttempt" RENAME TO "SessionRoute";

-- Rename indexes
ALTER INDEX "SessionRouteAttempt_sessionId_idx" RENAME TO "SessionRoute_sessionId_idx";
ALTER INDEX "SessionRouteAttempt_climbId_idx" RENAME TO "SessionRoute_climbId_idx";
ALTER INDEX "SessionRouteAttempt_pkey" RENAME TO "SessionRoute_pkey";

-- Rename foreign key constraints
-- Note: climbId_fkey was dropped in migration 20260116125900_remove_climb_relation_field
ALTER TABLE "SessionRoute" RENAME CONSTRAINT "SessionRouteAttempt_sessionId_fkey" TO "SessionRoute_sessionId_fkey";
