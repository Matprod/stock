import dayjs from "dayjs";
import { useParams } from "react-router-dom";
import { useGetNutritionDetail } from "./useGetNutritionDetail";
import { useGetMealsFilled } from "./useGetMealsFilled";
import { useDateStore } from "../store/date-store";
import { useGetAthlete } from "../lib/query/athletes/get_athlete";

export const useNutritionData = () => {
  const { playerId } = useParams();
  const { athleteDate } = useDateStore();

  const currentDate = athleteDate ?? dayjs().format("YYYY-MM-DD");

  const { data: athlete, isLoading: athleteLoading } = useGetAthlete(playerId);
  const {
    data: nutritionData,
    isLoading: nutritionLoading,
    error: nutritionError,
  } = useGetNutritionDetail(playerId, currentDate);

  const {
    data: mealsFilled,
    isLoading: mealsLoading,
    error: mealsError,
  } = useGetMealsFilled(playerId, currentDate);

  const isLoading = athleteLoading || nutritionLoading || mealsLoading;
  const hasError = nutritionError || mealsError;
  const hasNoData = !nutritionData || !athlete;

  return {
    playerId,
    athlete,
    nutritionData,
    mealsFilled,
    isLoading,
    hasError,
    hasNoData,
  };
};
