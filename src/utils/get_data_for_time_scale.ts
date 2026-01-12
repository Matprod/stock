import dayjs from "dayjs";
import type { ISeason } from "../types/player.types";

export type TimeScale = "7 days" | "30 days" | "3 months" | "6 months" | "season";

const getOldestDate = (timeScale: TimeScale | string, season?: ISeason) => {
  const referenceDate = season?.endDate ? dayjs(season.endDate) : dayjs();

  switch (timeScale) {
    case "7 days":
      return referenceDate.subtract(7, "day");
    case "30 days":
      return referenceDate.subtract(30, "day");
    case "3 months":
      return referenceDate.subtract(3, "month");
    case "6 months":
      return referenceDate.subtract(6, "month");
    case "season":
      return dayjs(season?.startDate);
    default:
      return referenceDate.subtract(7, "day");
  }
};

export const getDataForTimeScale = <T, K extends keyof T>(
  data: T[],
  timeScale: TimeScale | string,
  dateKey: K,
  season?: ISeason,
): T[] => {
  const oldestDate = getOldestDate(timeScale, season);
  const today = dayjs();
  const newestDate = (() => {
    if (!season?.endDate) {
      return today;
    }
    const seasonEndDate = dayjs(season.endDate);
    return seasonEndDate.isBefore(today) ? seasonEndDate : today;
  })();

  return data.filter((item) => {
    const dateValue = item[dateKey];
    if (typeof dateValue === "string" || dateValue instanceof Date) {
      const itemDate = dayjs(dateValue);
      return (
        (itemDate.isAfter(oldestDate) || itemDate.isSame(oldestDate, "day")) &&
        (itemDate.isBefore(newestDate) || itemDate.isSame(newestDate, "day"))
      );
    }
    return false;
  });
};
