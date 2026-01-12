const workoutHistoryKeys = {
  all: ["workoutHistory"] as const,
  lists: (seasonId: number | null = null) =>
    [...workoutHistoryKeys.all, "lists", seasonId] as const,
};

export default workoutHistoryKeys;
