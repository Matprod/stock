const injuryKeys = {
  all: ["injuries"] as const,
  lists: () => [...injuryKeys.all, "list"] as const,
  list: (seasonId: number | null = null) =>
    [...injuryKeys.lists(), { seasonId }] as const,
};

export default injuryKeys;
