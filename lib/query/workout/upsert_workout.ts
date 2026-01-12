import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { WorkoutFormData } from "../../../pages/workout-sessions/schemas/workout_schema";
import { fetchApi } from "../../../utils/fetch_api";
import workoutKeys from "./workout.keys";

const upsertWorkout = async (data: WorkoutFormData) => {
  const response = await fetchApi("workouts", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return response;
};

export const useUpsertWorkout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: upsertWorkout,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workoutKeys.lists() });
    },
  });
};
