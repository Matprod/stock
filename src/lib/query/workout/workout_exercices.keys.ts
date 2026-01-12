const workoutExercicesKeys = {
  all: ["workoutExercices"] as const,
  lists: () => [...workoutExercicesKeys.all, "lists"] as const,
};

export default workoutExercicesKeys;
