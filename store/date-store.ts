import { create } from "zustand";
import { persist } from "zustand/middleware";

interface DateState {
  athleteDate: string | null;
  teamDate: string | null;
  setAthleteDate: (date: string | null) => void;
  setTeamDate: (date: string | null) => void;
}

export const useDateStore = create<DateState>()(
  persist(
    (set) => ({
      athleteDate: null,
      teamDate: null,
      setAthleteDate: (date) => set({ athleteDate: date }),
      setTeamDate: (date) => set({ teamDate: date }),
    }),
    {
      name: "date-storage",
    },
  ),
);
