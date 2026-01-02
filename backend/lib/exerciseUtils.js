export function normalizeExerciseName(name) {
  return name.toLowerCase().trim();
}

export function calculateExerciseStats(setsDetail) {
  return setsDetail.reduce(
    (acc, set) => {
      const externalWeight = set.value;
      
      return {
        totalVolume: acc.totalVolume + (set.reps * externalWeight),
        totalReps: acc.totalReps + set.reps,
        maxWeight: Math.max(acc.maxWeight, externalWeight)
      };
    },
    { totalVolume: 0, totalReps: 0, maxWeight: 0 }
  );
}

