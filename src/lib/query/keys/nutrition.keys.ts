const nutritionKeys = {
  all: ["nutrition"] as const,
  detail: (athleteId: string, date: string) =>
    [...nutritionKeys.all, "detail", athleteId, date] as const,
  mealsFilled: (athleteId: string, date: string) =>
    [...nutritionKeys.all, "mealsFilled", athleteId, date] as const,
};

export default nutritionKeys;
