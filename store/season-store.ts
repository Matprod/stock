import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SeasonState {
  selectedSeasonId: number | null;
  setSelectedSeasonId: (seasonId: number | null) => void;
}

export const useSeasonStore = create<SeasonState>()(
  persist(
    (set) => ({
      selectedSeasonId: null,
      setSelectedSeasonId: (seasonId) => set({ selectedSeasonId: seasonId }),
    }),
    {
      name: "season-storage",
    },
  ),
);


