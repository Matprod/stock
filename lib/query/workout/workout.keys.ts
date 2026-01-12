const workoutKeys = {
  all: ["workouts"] as const,
  lists: () => [...workoutKeys.all, "lists"] as const,
};

export default workoutKeys;
