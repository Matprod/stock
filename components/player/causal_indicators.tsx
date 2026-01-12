import {
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  PointElement,
  RadialLinearScale,
  Tooltip,
} from "chart.js";
import { useMemo } from "react";
import type { IPlayer } from "../../types/player.types";
import { StatCard } from "./stat_card";
import { useTranslation } from "react-i18next";

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

interface IEvolutionProps {
  days: IPlayer["days"];
  type: "injury" | "performance";
}

export const CausalIndicators = ({ days, type }: IEvolutionProps) => {
  const { t } = useTranslation("player");
  const { activityAverage, nutritionAverage, sleepAverage, healthAverage } = useMemo(() => {
    const totals = days.reduce(
      (acc, cur) => {
        acc.activity +=
          type === "injury" ? (cur.injuryActivityScore ?? 0) : (cur.activityFinalScore ?? 0);
        acc.nutrition += cur.dailyAverage?.nutriScore ?? 0;
        acc.sleep += type === "injury" ? (cur.injurySleepScore ?? 0) : (cur.sleepFinalScore ?? 0);
        acc.health +=
          type === "injury" ? (cur.injuryHealthScore ?? 0) : (cur.healthFinalScore ?? 0);
        return acc;
      },
      { activity: 0, nutrition: 0, sleep: 0, health: 0 },
    );

    const { activityLength, nutritionLength, sleepLength, healthLength } = days.reduce(
      (acc, cur) => {
        acc.activityLength += +(type === "injury"
          ? cur.injuryActivityScore !== null
          : cur.activityFinalScore !== null);
        acc.nutritionLength += +(cur.dailyAverage?.nutriScore !== null);
        acc.sleepLength += +(type === "injury"
          ? cur.injurySleepScore !== null
          : cur.sleepFinalScore !== null);
        acc.healthLength += +(type === "injury"
          ? cur.injuryHealthScore !== null
          : cur.healthFinalScore !== null);

        return acc;
      },
      {
        activityLength: 0,
        nutritionLength: 0,
        sleepLength: 0,
        healthLength: 0,
      },
    );

    return {
      activityAverage: Math.round(totals.activity / activityLength),
      nutritionAverage: Math.round(totals.nutrition / nutritionLength),
      sleepAverage: Math.round(totals.sleep / sleepLength),
      healthAverage: Math.round(totals.health / healthLength),
    };
  }, [days, type]);

  // const { teamActivityAvg, teamNutritionAvg, teamSleepAvg, teamHealthAvg } = useMemo(() => {
  //   const totals = teamHistory.reduce(
  //     (acc, player) => {
  //       player.days.forEach((day) => {
  //         acc.activity += day.dailyAverage?.sportScore ?? 0;
  //         acc.nutrition += day.dailyAverage?.nutriScore ?? 0;
  //         acc.sleep += day.dailyAverage?.sleepScore ?? 0;
  //         acc.health += day.dailyAverage?.healthScore ?? 0;
  //       });
  //       return acc;
  //     },
  //     { activity: 0, nutrition: 0, sleep: 0, health: 0 },
  //   );

  //   const totalEntries = teamHistory.reduce((sum, player) => sum + player.days.length, 0) || 1;

  //   return {
  //     teamActivityAvg: totals.activity / totalEntries,
  //     teamNutritionAvg: totals.nutrition / totalEntries,
  //     teamSleepAvg: totals.sleep / totalEntries,
  //     teamHealthAvg: totals.health / totalEntries,
  //   };
  // }, [teamHistory]);

  // const labels = [
  //   t("causalIndicators.activities"),
  //   t("causalIndicators.nutrition"),
  //   t("causalIndicators.sleep"),
  //   t("causalIndicators.health"),
  // ];
  // const chartData = {
  //   labels,
  //   datasets: [
  //     {
  //       label: "Athlete",
  //       data: [activityAverage, nutritionAverage, sleepAverage, healthAverage],
  //       borderColor: "rgba(49, 140, 181, 1)",
  //       backgroundColor: "rgba(49, 140, 181, 0.2)",
  //       pointBackgroundColor: "rgba(54, 162, 235, 1)",
  //     },
  //     // {
  //     //   label: "Team",
  //     //   data: [teamActivityAvg, teamNutritionAvg, teamSleepAvg, teamHealthAvg],
  //     //   borderColor: "rgba(172, 226, 249, 1)",
  //     //   backgroundColor: "rgba(172, 226, 249, 0.2)",
  //     //   pointBackgroundColor: "rgba(75, 192, 192, 1)",
  //     // },
  //   ],
  // };

  // const options: ChartOptions<"radar"> = {
  //   responsive: true,
  //   maintainAspectRatio: false,
  //   scales: {
  //     r: {
  //       angleLines: {
  //         color: "rgba(90, 197, 242, 0.3)",
  //       },
  //       grid: {
  //         color: "rgba(90, 197, 242, 0.3)",
  //       },
  //       ticks: {
  //         color: "transparent",
  //         backdropColor: "transparent",
  //         font: {
  //           family: "Poppins",
  //           size: 14,
  //           weight: "bold",
  //         },
  //       },
  //       pointLabels: {
  //         color: "#FFF",
  //         font: {
  //           family: "Poppins",
  //           size: 16,
  //           weight: "bold",
  //         },
  //       },
  //       max: 100,
  //     },
  //   },
  //   plugins: {
  //     legend: {
  //       display: false,
  //     },
  //   },
  // };

  return (
    <div className="flex flex-col gap-y-4 card w-full bg-[#252d3b] rounded-3xl">
      <p className="text-center text-gray-100 font-medium text-xl">{t("causalIndicators.title")}</p>
      <div className="grid grid-cols-2 gap-4">
        <StatCard title={t("causalIndicators.activities")} value={activityAverage || undefined} />
        <StatCard title={t("causalIndicators.nutrition")} value={nutritionAverage || undefined} />
        <StatCard title={t("causalIndicators.sleep")} value={sleepAverage || undefined} />
        <StatCard title={t("causalIndicators.health")} value={healthAverage || undefined} />
      </div>
      {/* <div className="w-full h-72">
        <Radar data={chartData} options={options} />
      </div> */}
    </div>
  );
};
