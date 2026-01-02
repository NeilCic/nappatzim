export function normalizeExerciseName(name) {
  return name.toLowerCase().trim();
}

export function calculateExerciseStats(setsDetail, userWeight = 0) {
  return setsDetail.reduce(
    (acc, set) => {
      const externalWeight = set.value;
      const totalWeight = userWeight + externalWeight;
      const effectiveWeight = totalWeight > 0 ? totalWeight : 1;
      
      return {
        totalVolume: acc.totalVolume + (set.reps * effectiveWeight),
        totalReps: acc.totalReps + set.reps,
        maxWeight: Math.max(acc.maxWeight, externalWeight)
      };
    },
    { totalVolume: 0, totalReps: 0, maxWeight: 0 }
  );
}

