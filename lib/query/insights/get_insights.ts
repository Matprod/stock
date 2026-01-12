import { useQuery } from "@tanstack/react-query";
import type { Insights } from "../../../types/insight.types";
import { fetchApi } from "../../../utils/fetch_api";
import insightsKeys from "./insights.keys";

const getInsights = async (athleteId: string, date: string, category: string) => {
  const response = await fetchApi<Insights>(
    `athletes/${athleteId}/insights?date=${date}&type=${category}`,
    {
      method: "GET",
    },
  );

  return response;
};

export const useGetInsights = (athleteId?: string, date?: string, category?: string) => {
  return useQuery({
    enabled: !!athleteId && !!date && !!category,
    queryKey: insightsKeys.details(athleteId!, date!, category!),
    queryFn: () => getInsights(athleteId!, date!, category!),
  });
};
