import { useQuery } from "@tanstack/react-query";
import type { MealsFilled } from "../types/nutrition.types";
import { fetchApi } from "../utils/fetch_api";
import nutritionKeys from "../lib/query/keys/nutrition.keys";

const getMealsFilledApi = async (athleteId: string, date: string): Promise<MealsFilled> => {
  return fetchApi<MealsFilled>(`nutrition/${athleteId}/meals-filled?date=${date}`, {
    method: "GET",
  });
};

export const useGetMealsFilled = (athleteId?: string, date?: string) => {
  return useQuery({
    enabled: !!athleteId && !!date,
    queryKey: nutritionKeys.mealsFilled(athleteId!, date!),
    queryFn: () => getMealsFilledApi(athleteId!, date!),
  });
};

