"use client";

import {
  CategoryScale,
  Chart as ChartJS,
  // type ChartOptions,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
// import { Line } from "react-chartjs-2";
import { TimeScaleSelector } from "../../../components/time_scale_selector";
import type { IPlayer } from "../../../types/player.types";
import { getDataForTimeScale } from "../../../utils/get_data_for_time_scale";
import { getCurrentSeason } from "../../../utils/get_current_season";
import CircularProgress from "../../../components/ui/circular_progress";
import { getCircularProgressColor } from "../../../utils/circular_progress";
import { DynamicLineChart } from "../../../components/ui/dynamic_line_chart";
import { InfoIcon } from "lucide-react";
import { useSeasonStore } from "../../../store/season-store";
import { useUserPreferencesStore } from "../../../store/user-preferences-store";
ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend);

interface IAveragesProps {
  team: Array<IPlayer>;
  type: "injury" | "performance";
}

export const Averages = ({ team, type }: IAveragesProps) => {
  const { timeScale, setTimeScale } = useUserPreferencesStore();
  const { t } = useTranslation("dashboard");
  const { selectedSeasonId } = useSeasonStore();
  const currentSeason = useMemo(() => {
    if (!selectedSeasonId) {
      return getCurrentSeason(team[0]?.club.seasons, true);
    }
    return team[0]?.club.seasons.find((season) => season.id === selectedSeasonId);
  }, [team[0]?.club.seasons, selectedSeasonId]);

  const teamPlayersWithTimeScaledHistory = useMemo(() => {
    return team.map((player) => {
      return {
        ...player,
        history: getDataForTimeScale(player.days, timeScale, "dateOfDay", currentSeason),
      };
    });
  }, [timeScale, team, currentSeason]);

  const scoreByDateMap = useMemo(() => {
    const dateToRisks = new Map<
      string,
      {
        risk: number[];
        performance: number[];
        availability: number[];
        highPerformance: number[];
      }
    >();

    teamPlayersWithTimeScaledHistory.forEach((player) => {
      player.history.forEach((entry) => {
        const date = new Date(entry.dateOfDay).toISOString().slice(0, 10);
        const dateEntry = dateToRisks.get(date);

        if (!dateEntry) {
          dateToRisks.set(date, {
            risk: entry.injuryScore != null ? [entry.injuryScore ?? 0] : [],
            performance: entry.finalScore != null ? [entry.finalScore] : [],
            availability: entry.injuryScore != null ? [(entry.injuryScore ?? 0) < 10 ? 1 : 0] : [],
            highPerformance: entry.finalScore != null ? [entry.finalScore >= 40 ? 1 : 0] : [],
          });
          return;
        }
        if (entry.injuryScore != null) {
          dateEntry.risk.push(entry.injuryScore);
          dateEntry.availability.push(entry.injuryScore < 10 ? 1 : 0);
        }
        if (entry.finalScore != null) {
          dateEntry.performance.push(entry.finalScore);
          dateEntry.highPerformance.push(entry.finalScore >= 40 ? 1 : 0);
        }
        dateEntry.availability.push((entry.injuryScore ?? 0) < 10 ? 1 : 0);
      });
    });

    const averageByDate = new Map<
      string,
      {
        risk: number;
        performance: number;
        availability: number;
        highPerformance: number;
      }
    >();
    dateToRisks.forEach((score, date) => {
      const averageRisk = score.risk.reduce((acc, risk) => acc + risk, 0) / score.risk.length;
      const averagePerformance =
        score.performance.reduce((acc, performance) => acc + performance, 0) /
        score.performance.length;
      const availablePlayers = score.availability.reduce(
        (acc, availability) => acc + availability,
        0,
      );
      const playersWithData = score.availability.length;
      const averageAvailability =
        playersWithData > 0 ? (availablePlayers / playersWithData) * 100 : 0;
      const highPerformancePlayers = score.highPerformance.reduce(
        (acc, highPerformance) => acc + highPerformance,
        0,
      );
      const averageHighPerformance =
        highPerformancePlayers > 0
          ? (highPerformancePlayers / score.highPerformance.length) * 100
          : 0;
      averageByDate.set(date, {
        risk: averageRisk,
        performance: averagePerformance,
        availability: averageAvailability,
        highPerformance: averageHighPerformance,
      });
    });

    return averageByDate;
  }, [teamPlayersWithTimeScaledHistory]);

  const dates = useMemo(() => {
    return [...scoreByDateMap.keys()].sort((a, b) => a.localeCompare(b));
  }, [scoreByDateMap]);

  const performanceDates = useMemo(() => {
    return dates.filter((date) => !Number.isNaN(scoreByDateMap.get(date)!.performance));
  }, [dates, scoreByDateMap]);

  const { riskData, performanceData, availabilityData, highPerformanceData } = useMemo(() => {
    return {
      riskData: dates.map((date) => Math.round(scoreByDateMap.get(date)!.risk)),
      performanceData: dates
        .filter((date) => !Number.isNaN(scoreByDateMap.get(date)!.performance))
        .map((date) => Math.round(scoreByDateMap.get(date)!.performance)),
      availabilityData: dates.map((date) => Math.round(scoreByDateMap.get(date)!.availability)),
      highPerformanceData: dates.map((date) =>
        Math.round(scoreByDateMap.get(date)!.highPerformance),
      ),
    };
  }, [dates, scoreByDateMap]);

  return (
    <div className="p-4 border border-[#4c648a] rounded-3xl flex flex-col gap-y-4">
      <TimeScaleSelector
        currentTimeScale={timeScale}
        setCurrentTimeScale={setTimeScale}
        season={currentSeason}
      />
      <div className="flex flex-row gap-x-4">
        {type === "injury" ? (
          <>
            <TeamAverage
              title={t("averages.titles.teamRisk")}
              type="risk"
              labels={dates}
              data={riskData}
              info={t("averages.info.teamRiskInfo")}
            />
            <TeamAverage
              title={t("averages.titles.teamAvailability")}
              type="performance"
              labels={dates}
              data={availabilityData}
              info={t("averages.info.teamAvailabilityInfo")}
              // withoutCircularProgress
            />
          </>
        ) : (
          <>
            <TeamAverage
              title={t("averages.titles.teamPerformance")}
              type="performance"
              labels={performanceDates}
              data={performanceData}
              info={t("averages.info.teamPerformanceInfo")}
            />
            <TeamAverage
              title={t("averages.titles.teamHighPerformance")}
              type="performance"
              labels={dates}
              data={highPerformanceData}
              info={t("averages.info.teamHighPerformanceInfo")}
              // withoutCircularProgress
            />
          </>
        )}
      </div>
    </div>
  );
};

interface ITeamAverageProps {
  title: string;
  type: "risk" | "performance";
  labels: string[];
  data: number[];
  withoutCircularProgress?: boolean;
  info: string;
}

const TeamAverage = ({
  title,
  type,
  labels,
  data,
  withoutCircularProgress,
  info,
}: ITeamAverageProps) => {
  const currentAverage = useMemo(() => {
    if (data.length === 0) return undefined;
    const sum = data.reduce((acc, val) => acc + val, 0);
    return Math.round(sum / data.length);
  }, [data]);

  const chartData = useMemo(() => {
    return labels.map((date, idx) => ({
      dateOfDay: date,
      value: Math.round(data[idx] ?? 0),
    }));
  }, [labels, data]);

  return (
    <div className="flex flex-col gap-y-4 card w-full bg-[#252d3b] rounded-3xl border border-[#3a4454]">
      <div className="font-medium text-xl text-gray-100 flex items-center gap-x-2">
        {title}
        <div className="group relative">
          <InfoIcon className="w-4 h-4 text-gray-400 hover:text-gray-400 cursor-help" />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#142836fc] text-gray-100 text-xs rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 whitespace-normal z-10 w-[220px] shadow-lg">
            {info}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center">
        {withoutCircularProgress ? (
          <div className="w-[100px] h-[100px]" />
        ) : (
          <CircularProgress
            progress={currentAverage}
            color={getCircularProgressColor(
              currentAverage ?? 0,
              type === "risk" ? "injury" : "performance",
            )}
            size={100}
          />
        )}
      </div>
      <div className="w-full h-60 px-4 pb-4">
        <DynamicLineChart days={chartData} type={type === "risk" ? "injury" : "performance"} />
      </div>
    </div>
  );
};
