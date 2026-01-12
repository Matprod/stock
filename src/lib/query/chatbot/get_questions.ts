import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "../../../utils/fetch_api";
import type { IQuestionsResponse } from "../../../types/chatbot.types";
import chatbotKeys from "./chatbot.keys";

const getQuestions = async (category: "injury" | "performance") => {
  const response = await fetchApi<IQuestionsResponse>(
    `/chatbots/questions?category=${category}&limit=4`,
    {
      method: "GET",
    },
  );

  return response.questions;
};

export const useGetQuestions = (category: "injury" | "performance") => {
  return useQuery({
    queryKey: chatbotKeys.questions(category),
    queryFn: () => getQuestions(category),
  });
};
