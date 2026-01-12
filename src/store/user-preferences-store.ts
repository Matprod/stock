import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TimeScale } from "../utils/get_data_for_time_scale";

interface UserPreferencesState {
  isChatOpen: boolean;
  setIsChatOpen: (value: boolean) => void;
  chatWidth: number;
  setChatWidth: (value: number) => void;
  isQuickActionsExpanded: boolean;
  setIsQuickActionsExpanded: (value: boolean) => void;
  timeScale: TimeScale;
  setTimeScale: (value: TimeScale) => void;
}

export const useUserPreferencesStore = create<UserPreferencesState>()(
  persist(
    (set) => ({
      isChatOpen: true,
      setIsChatOpen: (value) => set({ isChatOpen: value }),
      chatWidth: 440,
      setChatWidth: (value) => set({ chatWidth: value }),
      isQuickActionsExpanded: true,
      setIsQuickActionsExpanded: (value) => set({ isQuickActionsExpanded: value }),
      timeScale: "3 months",
      setTimeScale: (value) => set({ timeScale: value }),
    }),
    {
      name: "user-preferences-storage",
    },
  ),
);
