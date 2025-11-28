export function normalizeExerciseName(name) {
  return name.toLowerCase().trim();
}

export function calculateExerciseStats(setsDetail) {
  return setsDetail.reduce(
    (acc, set) => ({
      totalVolume: acc.totalVolume + (set.reps * (set.value || 1)),
      totalReps: acc.totalReps + set.reps,
      maxWeight: Math.max(acc.maxWeight, set.value || 0)
    }),
    { totalVolume: 0, totalReps: 0, maxWeight: 0 }
  );
}

