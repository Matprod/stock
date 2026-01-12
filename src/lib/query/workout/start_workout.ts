import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "../../../utils/fetch_api";
import workoutKeys from "./workout.keys";
import type { StartSessionPayload } from "../../../types/workout.types";
import workoutHistoryKeys from "./workout_history.keys";

const startWorkout = async (data: StartSessionPayload) => {
  const response = await fetchApi("workouts/start", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return response;
};

export const useStartWorkout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: startWorkout,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workoutKeys.lists() });
      queryClient.invalidateQueries({ queryKey: workoutHistoryKeys.all });
    },
  });
};
