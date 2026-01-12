import { create } from "zustand";
import { persist } from "zustand/middleware";

interface DemoState {
  isDemo: boolean;
  setIsDemo: (isDemo: boolean) => void;
}

export const useDemoStore = create<DemoState>()(
  persist(
    (set) => ({
      isDemo: false,
      setIsDemo: (isDemo) => set({ isDemo }),
    }),
    {
      name: "date-storage",
    },
  ),
);
