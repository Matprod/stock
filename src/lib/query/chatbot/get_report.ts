import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "../../../utils/fetch_api";
import type { IChatbotReportResponse } from "../../../types/chatbot.types";
import chatbotKeys from "./chatbot.keys";

const getReport = async (
  athleteId: number,
  date: string,
  category: "performance" | "injury"
): Promise<IChatbotReportResponse> => {
  const queryParams = new URLSearchParams({
    athleteId: String(athleteId),
    date,
    category,
  });

  const response = await fetchApi<IChatbotReportResponse>(
    `/chatbots/report?${queryParams}`,
    {
      method: "GET",
    }
  );

  return response;
};

export const useGetChatbotReport = (
  athleteId: number | undefined,
  date: string | null,
  category: "performance" | "injury"
) => {
  return useQuery({
    queryKey: chatbotKeys.report(athleteId, date, category),
    queryFn: () => getReport(athleteId!, date!, category),
    enabled: !!athleteId && !!date,
  });
};

