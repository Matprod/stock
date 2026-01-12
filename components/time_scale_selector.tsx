import { twMerge } from "tailwind-merge";
import type { TimeScale } from "../utils/get_data_for_time_scale";
import { useTranslation } from "react-i18next";
import type { ISeason } from "../types/player.types";

interface ITimeScaleSelectorProps {
  currentTimeScale: TimeScale;
  setCurrentTimeScale: (value: TimeScale) => void;
  season?: ISeason;
}

const TIME_SCALE_TO_TRANSLATION_KEY: Record<
  TimeScale,
  | "timeScale.7days"
  | "timeScale.30days"
  | "timeScale.3months"
  | "timeScale.6months"
  | "timeScale.season"
> = {
  "7 days": "timeScale.7days",
  "30 days": "timeScale.30days",
  "3 months": "timeScale.3months",
  "6 months": "timeScale.6months",
  season: "timeScale.season",
};

export const TimeScaleSelector = ({
  currentTimeScale,
  setCurrentTimeScale,
  season,
}: ITimeScaleSelectorProps) => {
  const { t } = useTranslation("common");

  const timeScales: TimeScale[] = ["7 days", "30 days", "3 months", "6 months"];
  if (season) {
    timeScales.push("season");
  }

  return (
    <div className="flex flex-row gap-x-2">
      {timeScales.map((timeScale) => (
        <button
          type="button"
          key={timeScale}
          onClick={() => setCurrentTimeScale(timeScale)}
          className={twMerge(
            "p-2",
            timeScale === currentTimeScale && "bg-blue-400 text-black rounded-xl",
          )}
        >
          {t(TIME_SCALE_TO_TRANSLATION_KEY[timeScale])}
        </button>
      ))}
    </div>
  );
};
