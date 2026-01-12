import dayjs from "dayjs";
import type { ISeason } from "../types/player.types";

export const getCurrentSeason = (
  seasons: ISeason[],
  latestSeason?: boolean,
): ISeason | undefined => {
  const now = dayjs();
  const currentSeason = seasons.find((season) => {
    return dayjs(season.startDate).isBefore(now) && dayjs(season.endDate).isAfter(now);
  });
  if (!currentSeason && latestSeason) {
    return seasons.sort((a, b) => dayjs(b.startDate).diff(dayjs(a.startDate)))[0];
  }
  return currentSeason;
};
