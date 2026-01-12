const chatbotKeys = {
  all: ["chatbot"] as const,
  lists: () => [...chatbotKeys.all, "lists"] as const,
  questions: (category: "injury" | "performance") =>
    [...chatbotKeys.all, "questions", category] as const,
  report: (
    athleteId: number | undefined,
    date: string | null,
    category: "injury" | "performance"
  ) => [...chatbotKeys.all, "report", athleteId, date, category] as const,
};

export default chatbotKeys;
