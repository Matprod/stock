import { useQuery } from "@tanstack/react-query";
import nutritionKeys from "../lib/query/keys/nutrition.keys";
import type { APINutritionDay, NutritionDetail } from "../types/nutrition.types";
import { fetchApi } from "../utils/fetch_api";
import { transformNutritionDetail } from "../utils/nutrition.transform";

const getNutritionDetailApi = async (
  athleteId: string,
  date: string,
): Promise<NutritionDetail> => {
  const response = await fetchApi<APINutritionDay>(`nutrition/${athleteId}/nutrition-detail?date=${date}`, {
    method: "GET",
  });
  return transformNutritionDetail(response);
};

export const useGetNutritionDetail = (athleteId?: string, date?: string) => {
  return useQuery({
    enabled: !!athleteId && !!date,
    queryKey: nutritionKeys.detail(athleteId!, date!),
    queryFn: async () => {
      return await getNutritionDetailApi(athleteId!, date!);
    },
  });
};

