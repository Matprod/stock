const insightsKeys = {
  all: ["insights"] as const,
  details: (athleteId: string, date: string, category: string) =>
    [...insightsKeys.all, "details", athleteId, date, category] as const,
};

export default insightsKeys;
