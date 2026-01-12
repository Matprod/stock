import dayjs from "dayjs";
import type { IPlayer } from "../types/player.types";
import { isPlayerInjured } from "./is_player_injured";

export const getDayStats = (date: Date, team: Array<IPlayer>) => {
  return team
    .map((player) => {
      const day = player.days.find((entry) => dayjs(entry.dateOfDay).isSame(dayjs(date), "day"));
      const isInjured = isPlayerInjured(player.injuries, dayjs(date));

      if (day) {
        return { ...day, isInjured };
      }

      if (isInjured) {
        return {
          dateOfDay: dayjs(date).format("YYYY-MM-DD"),
          isInjured: true,
          injuryScore: 20,
          finalScore: null,
        };
      }

      return null;
    })
    .filter((day): day is NonNullable<typeof day> => day !== null);
};
