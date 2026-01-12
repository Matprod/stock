import { create } from "zustand";
import { persist } from "zustand/middleware";

interface DevState {
  isDev: boolean;
  setIsDev: (isDev: boolean) => void;
}

export const useDevStore = create<DevState>()(
  persist(
    (set) => ({
      isDev: false,
      setIsDev: (isDev) => set({ isDev }),
    }),
    {
      name: "date-storage",
    },
  ),
);
