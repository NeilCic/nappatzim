-- CreateIndex
CREATE INDEX "Exercise_workoutId_order_idx" ON "public"."Exercise"("workoutId", "order");

-- CreateIndex
CREATE INDEX "Workout_userId_createdAt_idx" ON "public"."Workout"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Workout_userId_categoryId_idx" ON "public"."Workout"("userId", "categoryId");

-- CreateIndex
CREATE INDEX "Workout_categoryId_createdAt_idx" ON "public"."Workout"("categoryId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkoutCategory_userId_idx" ON "public"."WorkoutCategory"("userId");

-- CreateIndex
CREATE INDEX "WorkoutCategory_userId_name_idx" ON "public"."WorkoutCategory"("userId", "name");
