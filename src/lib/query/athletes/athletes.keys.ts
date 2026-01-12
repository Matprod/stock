const athletesKeys = {
  all: ["athletes"] as const,
  lists: () => [...athletesKeys.all, "lists"] as const,
  list: (seasonId: number | null = null) =>
    [...athletesKeys.lists(), { seasonId }] as const,
  dashboardList: (seasonId: number | null = null) =>
    [...athletesKeys.all, "dashboardList", { seasonId }] as const,
  details: (id: string, seasonId: number | null = null) =>
    [...athletesKeys.all, "details", id, { seasonId }] as const,
};

export default athletesKeys;
