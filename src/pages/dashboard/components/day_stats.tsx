"use client";

import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import CircularProgress from "../../../components/ui/circular_progress";
import { DateNavigation } from "../../../components/ui/date-navigation";
import type { IPlayer } from "../../../types/player.types";
import { getCircularProgressColor } from "../../../utils/circular_progress";
import { getDayStats } from "../../../utils/get_day_stats";
import { useDateStore } from "../../../store/date-store";
import { InfoIcon } from "lucide-react";

interface IDayStatsProps {
  team: Array<IPlayer>;
  type: "injury" | "performance";
}

export const DayStats = ({ team, type }: IDayStatsProps) => {
  const { teamDate, setTeamDate } = useDateStore();
  const { t } = useTranslation("dashboard");

  const getLabel = (score: number, labelType: "injury" | "performance" | "availability") => {
    if (labelType === "performance") {
      if (score >= 70) return t("dayStats.labels.highPerformance");
      if (score >= 40) return t("dayStats.labels.mediumPerformance");
      return t("dayStats.labels.lowPerformance");
    }
    if (labelType === "injury") {
      if (score >= 20) return t("dayStats.labels.highRisk");
      if (score < 10) return t("dayStats.labels.readyToPlay");
      return t("dayStats.labels.moderateRisk");
    }
    if (labelType === "availability") {
      if (score >= 70) return t("dayStats.labels.highPerformance");
      if (score >= 40) return t("dayStats.labels.mediumPerformance");
      return t("dayStats.labels.lowPerformance");
    }
  };

  const daysWithStats = useMemo(() => {
    const uniqueDates = new Set<string>();
    team.forEach((player: IPlayer) => {
      player.days.forEach((entry) => {
        uniqueDates.add(dayjs(entry.dateOfDay).format("YYYY-MM-DD"));
      });
    });
    const sortedDates = Array.from(uniqueDates).sort((a, b) => a.localeCompare(b));
    return sortedDates.map((date) => dayjs(date));
  }, [team]);

  const [currentDayIndex, setCurrentDayIndex] = useState(() => {
    if (teamDate && daysWithStats.length > 0) {
      const storedDate = dayjs(teamDate);
      const index = daysWithStats.findIndex((date) => date.isSame(storedDate, "day"));
      return index !== -1 ? index : daysWithStats.length - 1;
    }
    return daysWithStats.length - 1;
  });

  const selectedDate = daysWithStats[currentDayIndex];

  useEffect(() => {
    if (selectedDate) {
      setTeamDate(selectedDate.format("YYYY-MM-DD"));
    }
  }, [selectedDate, setTeamDate]);

  const dayStats = useMemo(() => {
    if (!selectedDate) return [];
    return getDayStats(selectedDate.toDate(), team);
  }, [selectedDate, team]);

  const {
    dayRisks,
    dayPerformances,
    injured,
    highRisk,
    moderateRisk,
    readyToPlay,
    lowPerformance,
    mediumPerfomance,
    highPerformance,
  } = useMemo(() => {
    const validDays = dayStats.filter((day) => day.finalScore != null);
    const totals = dayStats.reduce(
      (acc, day) => {
        const risk = day.injuryScore;
        const performance = day.finalScore;

        if (risk != null) {
          acc.dayRisks += risk;
        }
        if (performance != null) {
          acc.dayPerformances += performance;
        }

        if (!day.isInjured) {
          if (risk != null && risk >= 20) acc.highRisk++;
          else if (risk != null && risk >= 10) acc.moderateRisk++;
          else if (risk != null && risk < 10) acc.readyToPlay++;
        } else {
          acc.injured++;
        }

        if (performance != null && performance >= 70) acc.highPerformance++;
        else if (performance != null && performance >= 40) {
          acc.mediumPerfomance++;
        } else if (performance != null) acc.lowPerformance++;

        return acc;
      },
      {
        dayRisks: 0,
        dayPerformances: 0,
        injured: 0,
        highRisk: 0,
        moderateRisk: 0,
        readyToPlay: 0,
        lowPerformance: 0,
        mediumPerfomance: 0,
        highPerformance: 0,
      },
    );

    const riskDaysCount = dayStats.reduce(
      (count, day) => (day.injuryScore != null ? count + 1 : count),
      0,
    );
    return {
      ...totals,
      dayRisks: riskDaysCount > 0 ? totals.dayRisks / riskDaysCount : undefined,
      dayPerformances: validDays.length > 0 ? totals.dayPerformances / validDays.length : undefined,
    } as typeof totals & { dayRisks: number | undefined; dayPerformances: number | undefined };
  }, [dayStats]);

  const handlePreviousDay = () => {
    if (currentDayIndex > 0) {
      setCurrentDayIndex(currentDayIndex - 1);
    }
  };

  const handleNextDay = () => {
    if (currentDayIndex < daysWithStats.length - 1) {
      setCurrentDayIndex(currentDayIndex + 1);
    }
  };

  const handleDateChange = (newDate: Dayjs) => {
    const newIndex = daysWithStats.findIndex((date) => date.isSame(newDate, "day"));
    if (newIndex !== -1) {
      setCurrentDayIndex(newIndex);
    }
  };

  const numberPlayersWithInjuryDataToday = useMemo(() => {
    return dayStats.filter((d) => d.injuryScore != null).length;
  }, [dayStats]);

  const availability = useMemo(() => {
    if (numberPlayersWithInjuryDataToday === 0) return undefined;
    return (readyToPlay / numberPlayersWithInjuryDataToday) * 100;
  }, [readyToPlay, numberPlayersWithInjuryDataToday]);

  const numberPlayersWithPerformanceDataToday = useMemo(() => {
    return dayStats.filter((d) => d.finalScore != null).length;
  }, [dayStats]);

  const goodPerformancePercentage = useMemo(() => {
    if (numberPlayersWithPerformanceDataToday <= 0) return undefined;
    return ((highPerformance + mediumPerfomance) / numberPlayersWithPerformanceDataToday) * 100;
  }, [highPerformance, mediumPerfomance, numberPlayersWithPerformanceDataToday]);

  return (
    <>
      <div className="card w-full flex flex-col items-center bg-[#252d3b] rounded-3xl">
        <div className="w-full bg-[#252d3b] border-b border-[#3a4454] px-4 pb-4 pt-0 flex justify-center rounded-t-3xl">
          <div className="bg-[#252d3b] rounded-2xl shadow-md border border-[#3a4454] p-3">
            <DateNavigation
              daysWithStats={daysWithStats}
              selectedDate={selectedDate}
              currentDayIndex={currentDayIndex}
              onPreviousDay={handlePreviousDay}
              onNextDay={handleNextDay}
              onDateChange={handleDateChange}
              type="team"
            />
          </div>
        </div>
        <div className="w-full flex flex-row items-center justify-around mt-4">
          <div className="flex flex-col gap-4 w-1/3">
            <RepartitionCard title={t("dayStats.labels.injured")} value={injured} />
            <div className="grid grid-cols-3 gap-4">
              {type === "injury" ? (
                <>
                  <RepartitionCard title={t("dayStats.labels.highRisk")} value={highRisk} />
                  <RepartitionCard title={t("dayStats.labels.moderateRisk")} value={moderateRisk} />
                  <RepartitionCard title={t("dayStats.labels.readyToPlay")} value={readyToPlay} />
                </>
              ) : (
                <>
                  <RepartitionCard
                    title={t("dayStats.labels.lowPerformance")}
                    value={lowPerformance}
                  />
                  <RepartitionCard
                    title={t("dayStats.labels.mediumPerformance")}
                    value={mediumPerfomance}
                  />
                  <RepartitionCard
                    title={t("dayStats.labels.highPerformance")}
                    value={highPerformance}
                  />
                </>
              )}
            </div>
          </div>
          {type === "injury" ? (
            <>
              <div className="flex flex-col items-center gap-y-4">
                <div className="font-medium text-center text-xl text-gray-100 flex items-center gap-x-2">
                  {t("dayStats.teamStats.injury.title")}
                  <div className="group relative">
                    <InfoIcon className="w-4 h-4 text-gray-400 hover:text-gray-400 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#142836fc] text-gray-100 text-xs rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 whitespace-normal z-10 w-[220px] shadow-lg">
                      {t("dayStats.info.teamRiskInfo")}
                    </div>
                  </div>
                </div>
                <CircularProgress
                  progress={dayRisks}
                  color={getCircularProgressColor(dayRisks, "injury")}
                />
                <p className="text-sm font-medium text-gray-400">{getLabel(dayRisks, "injury")}</p>
              </div>
              <div className="flex flex-col items-center gap-y-4">
                <div className="font-medium text-center text-xl text-gray-100 flex items-center gap-x-2">
                  {t("dayStats.teamStats.injury.availability")}
                  <div className="group relative">
                    <InfoIcon className="w-4 h-4 text-gray-400 hover:text-gray-400 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#142836fc] text-gray-100 text-xs rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 whitespace-normal z-10 w-[220px] shadow-lg">
                      {t("dayStats.info.teamAvailabilityInfo")}
                    </div>
                  </div>
                </div>
                <CircularProgress
                  progress={availability}
                  color={getCircularProgressColor(availability, "availability")}
                />
                <p className="text-sm font-medium text-gray-400">
                  {getLabel(availability ?? 0, "availability")}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col items-center gap-y-4">
                <div className="font-medium text-center text-xl text-gray-100 flex items-center gap-x-2">
                  {t("dayStats.teamStats.performance.title")}
                  <div className="group relative">
                    <InfoIcon className="w-4 h-4 text-gray-400 hover:text-gray-400 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#142836fc] text-gray-100 text-xs rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 whitespace-normal z-10 w-[220px] shadow-lg">
                      {t("dayStats.info.teamPerformanceInfo")}
                    </div>
                  </div>
                </div>
                <CircularProgress
                  progress={dayPerformances}
                  color={getCircularProgressColor(dayPerformances ?? 0, "performance")}
                />
                <p className="text-sm font-medium text-gray-400">
                  {dayPerformances != null ? getLabel(dayPerformances, "performance") : "-"}
                </p>
              </div>
              <div className="flex flex-col items-center gap-y-4">
                <div className="font-medium text-center text-xl text-gray-100 flex items-center gap-x-2">
                  {t("dayStats.teamStats.performance.highPerformance")}
                  <div className="group relative">
                    <InfoIcon className="w-4 h-4 text-gray-400 hover:text-gray-400 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#142836fc] text-gray-100 text-xs rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 whitespace-normal z-10 w-[220px] shadow-lg">
                      {t("dayStats.info.highPerformanceInfo")}
                    </div>
                  </div>
                </div>
                <CircularProgress
                  progress={goodPerformancePercentage}
                  color={getCircularProgressColor(goodPerformancePercentage ?? 0, "performance")}
                />
                <p className="text-sm font-medium text-gray-400">
                  {goodPerformancePercentage != null
                    ? getLabel(goodPerformancePercentage, "performance")
                    : "-"}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

const RepartitionCard = ({ title, value }: { title: string; value: number }) => {
  return (
    <div className="flex flex-col gap-y-2 card text-xs w-full text-center p-3 rounded-3xl bg-[#252d3b] border border-[#3a4454]">
      <p className="text-3xl font-semibold text-white">{value}</p>
      <p className="font-medium text-sm text-gray-400">{title}</p>
    </div>
  );
};
