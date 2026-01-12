const notesKeys = {
  all: ["notes"] as const,
  lists: () => [...notesKeys.all, "list"] as const,
  list: (seasonId: number | null = null) =>
    [...notesKeys.lists(), { seasonId }] as const,
};

export default notesKeys;
