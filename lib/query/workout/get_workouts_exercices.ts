import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "../../../utils/fetch_api";
import workoutExercicesKeys from "./workout_exercices.keys";
import type { WorkoutExercice } from "../../../types/workout.types";

const getWorkoutsExercices = async () => {
  const response = await fetchApi<WorkoutExercice[]>("/workouts/workout-exercices", {
    method: "GET",
  });

  return response;
};

export const useGetWorkoutsExercices = () => {
  return useQuery({
    queryKey: workoutExercicesKeys.lists(),
    queryFn: () => getWorkoutsExercices(),
  });
};
