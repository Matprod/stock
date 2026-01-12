import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "../../../utils/fetch_api";
import workoutHistoryKeys from "./workout_history.keys";
import type { APIWorkoutHistory } from "../../../types/workout.types";
import { useSeasonStore } from "../../../store/season-store";

const getWorkoutsHistory = async () => {
  const response = await fetchApi<APIWorkoutHistory[]>("/workouts/history", {
    method: "GET",
  });

  return response;
};

export const useGetWorkoutsHistory = () => {
  const { selectedSeasonId } = useSeasonStore();

  return useQuery({
    queryKey: workoutHistoryKeys.lists(selectedSeasonId),
    queryFn: () => getWorkoutsHistory(),
  });
};
