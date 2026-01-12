"use client";

import { useMemo } from "react";
import dayjs from "dayjs";
import CircularProgress from "../../components/ui/circular_progress";
import type { IPlayer } from "../../types/player.types";
import { getCircularProgressColor } from "../../utils/circular_progress";
import { useTranslation } from "react-i18next";
import { DynamicLineChart, type ChartEvent } from "../ui/dynamic_line_chart";

interface IEvolutionProps {
  days: Array<IPlayer["days"][number]>;
  injuries?: Array<IPlayer["injuries"][number]>;
  type: "injury" | "performance";
  playerId: number;
}

const normalizeInjuryScore = (score: number | null): number => {
  const value = score ?? 0;
  return value === 0 ? 1 : value;
};

export const Evolution = ({ days, injuries = [], type, playerId }: IEvolutionProps) => {
  const { t, i18n } = useTranslation("player");

  const average = useMemo(() => {
    if (days.length === 0) return 0;
    const { sum, count } = days.reduce(
      (acc, day) => {
        const score = type === "injury" ? normalizeInjuryScore(day.injuryScore) : day.finalScore;
        if (score != null) {
          return { sum: acc.sum + score, count: acc.count + 1 };
        }
        return acc;
      },
      { sum: 0, count: 0 },
    );
    return count === 0 ? 0 : sum / count;
  }, [days, type]);

  const chartData = useMemo(() => {
    const existingData = days
      .map((day) => {
        const value = type === "injury" ? normalizeInjuryScore(day.injuryScore) : day.finalScore;
        return value != null ? { dateOfDay: day.dateOfDay, value: Math.round(value) } : null;
      })
      .filter((item): item is { dateOfDay: string; value: number } => item !== null);

    if (type !== "injury" || !injuries || injuries.length === 0) {
      return existingData;
    }

    const existingDates = new Set(existingData.map((d) => d.dateOfDay));
    const injuryDays: Array<{ dateOfDay: string; value: number }> = [];

    injuries.forEach((injury) => {
      const startDate = dayjs(injury.dateOfInjury);
      const endDate = injury.recoveryDate ? dayjs(injury.recoveryDate) : dayjs();

      let currentDate = startDate;
      while (currentDate.isSameOrBefore(endDate, "day")) {
        const dateStr = currentDate.format("YYYY-MM-DD");
        if (!existingDates.has(dateStr)) {
          injuryDays.push({
            dateOfDay: dateStr,
            value: 1,
          });
        }

        currentDate = currentDate.add(1, "day");
      }
    });

    const mergedData = [...existingData, ...injuryDays].sort(
      (a, b) => new Date(a.dateOfDay).getTime() - new Date(b.dateOfDay).getTime(),
    );

    return mergedData;
  }, [days, type, injuries]);

  const chartEvents: ChartEvent[] = useMemo(() => {
    const events: ChartEvent[] = [];

    if (type === "injury" && injuries) {
      events.push(
        ...injuries.map((inj) => ({
          startDate: inj.dateOfInjury,
          endDate: inj.recoveryDate,
          name: i18n.language === "fr" ? inj.injuryType.nameFr : inj.injuryType.nameEn,
          type: "injury" as const,
        })),
      );
    }

    if (type === "performance") {
      events.push(
        ...days
          .filter((day) =>
            day.sportActivities?.some((activity) => {
              return Boolean(activity.gameActivity);
            }),
          )
          .map((day) => ({
            startDate: day.dateOfDay,
            endDate: null,
            name: "Match",
            type: "match" as const,
          })),
      );
    }

    return events;
  }, [injuries, type, i18n.language, days]);

  const matchCount = chartEvents.filter((e) => e.type === "match").length;
  const injuryCount = injuries.length;
  const hasMatches = type === "performance" && matchCount > 0;
  const hasInjuries = type === "injury" && injuryCount > 0;

  return (
    <div className="flex bg-[#252d3b] rounded-3xl flex-col gap-y-4 card w-full">
      <p className="text-center text-gray-100 font-medium text-xl">
        {type === "injury" ? t("evolution.risk") : t("evolution.performance")}
      </p>
      <CircularProgress
        progress={average}
        color={getCircularProgressColor(average, type)}
        size={100}
      />
      <DynamicLineChart days={chartData} events={chartEvents} type={type} playerId={playerId} />
      {hasInjuries && (
        <div className="flex items-center justify-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500 border border-white" />
          <span className="text-xs text-gray-400">
            {t("evolution.injuryLabel", { count: injuryCount })}
          </span>
        </div>
      )}
      {hasMatches && (
        <div className="flex items-center justify-center gap-2">
          <div className="w-3 h-3 rounded-full bg-sky-400 border border-white" />
          <span className="text-xs text-gray-400">
            {t("evolution.matchLabel", { count: matchCount })}
          </span>
        </div>
      )}
    </div>
  );
};
