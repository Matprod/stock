import { useMemo } from "react";
import type { IPlayer } from "../../types/player.types";
import { useTranslation } from "react-i18next";

interface IDaysRepartitionProps {
  days: Array<IPlayer["days"][number]>;
  type: "injury" | "performance";
}

export const DaysRepartition = ({ days, type }: IDaysRepartitionProps) => {
  const { t } = useTranslation("player");
  const {
    injuredDays,
    highRiskDays,
    moderateRiskDays,
    readyToPlayDays,
    lowPerformanceDays,
    mediumPerfomanceDays,
    highPerformanceDays,
  } = useMemo(() => {
    const totals = days.reduce(
      (acc, { finalScore, injuryScore }) => {
        if (injuryScore === 100) {
          acc.injuredDays++;
          return acc;
        }
        if ((injuryScore ?? 0) >= 20) acc.highRiskDays++;
        else if ((injuryScore ?? 0) >= 10) acc.moderateRiskDays++;
        else acc.readyToPlayDays++;

        if ((finalScore ?? 0) >= 70) acc.highPerformanceDays++;
        else if ((finalScore ?? 0) >= 40) acc.mediumPerfomanceDays++;
        else acc.lowPerformanceDays++;

        return acc;
      },
      {
        injuredDays: 0,
        highRiskDays: 0,
        moderateRiskDays: 0,
        readyToPlayDays: 0,
        lowPerformanceDays: 0,
        mediumPerfomanceDays: 0,
        highPerformanceDays: 0,
      },
    );

    return totals;
  }, [days]);

  return (
    <div className="flex bg-[#252d3b] rounded-3xl flex-col gap-y-4 card w-full">
      <p className="text-center text-gray-100 font-medium text-xl">
        {type === "injury" ? t("daysRepartition.injuryRisks") : t("daysRepartition.performance")}
      </p>
      <div className="flex flex-col gap-y-4">
        <RepartitionCard title={t("daysRepartition.injuredDays")} value={injuredDays} />
        <div className="grid grid-cols-3 gap-4">
          {type === "injury" ? (
            <>
              <RepartitionCard title={t("daysRepartition.highRiskDays")} value={highRiskDays} />
              <RepartitionCard
                title={t("daysRepartition.moderateRiskDays")}
                value={moderateRiskDays}
              />
              <RepartitionCard
                title={t("daysRepartition.readyToPlayDays")}
                value={readyToPlayDays}
              />
            </>
          ) : (
            <>
              <RepartitionCard
                title={t("daysRepartition.lowPerformance")}
                value={lowPerformanceDays}
              />
              <RepartitionCard
                title={t("daysRepartition.mediumPerformance")}
                value={mediumPerfomanceDays}
              />
              <RepartitionCard
                title={t("daysRepartition.highPerformance")}
                value={highPerformanceDays}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const RepartitionCard = ({ title, value }: { title: string; value: number }) => {
  return (
    <div className="flex flex-col gap-y-2 card text-xs w-full text-center p-2 rounded-3xl bg-[#252d3b] border border-[#3a4454]">
      <p className="text-2xl text-gray-100">{value}</p>
      <p className="text-sm text-gray-400">{title}</p>
    </div>
  );
};
