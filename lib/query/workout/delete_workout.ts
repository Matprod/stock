import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "../../../utils/fetch_api";
import workoutKeys from "./workout.keys";

const deleteWorkout = async (id: number) => {
  const response = await fetchApi(`workouts/${id}`, {
    method: "DELETE",
  });
  return response;
};

export const useDeleteWorkout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteWorkout,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workoutKeys.lists() });
      // queryClient.invalidateQueries({
      // queryKey: [...workoutKeys.lists(), "athlete"],
      // });
    },
  });
};
