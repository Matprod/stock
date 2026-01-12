import { twMerge } from "tailwind-merge";
import type { InsightStatus, NewInsight } from "../../../../types/insight.types";
import {
  InfoIcon,
  SearchIcon,
  HeartIcon,
  MoonIcon,
  AppleIcon,
  ActivityIcon,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import getInsightStatus from "../../../../utils/get_insight_status";

const getMacroTypeFromLabel = (label: string): string => {
  const lowerLabel = label.toLowerCase();

  if (lowerLabel.includes("protein") || lowerLabel.includes("protéine")) {
    return "protein";
  }
  if (lowerLabel.includes("carb") || lowerLabel.includes("glucide")) {
    return "carbs";
  }
  if (lowerLabel.includes("fat") || lowerLabel.includes("lipide")) {
    return "fats";
  }
  if (lowerLabel.includes("calorie")) {
    return "calories";
  }
  return "protein";
};

const isMacronutrientInsight = (insight: NewInsight): boolean => {
  if (insight.type !== "nutrition") return false;

  const lowerLabel = insight.label.toLowerCase();

  const is7Days =
    lowerLabel.includes("7 days") || lowerLabel.includes("7 jours") || lowerLabel.includes("7days");
  if (is7Days) return false;

  const isDailyIntake =
    lowerLabel.includes("daily intake") ||
    lowerLabel.includes("apport quotidien") ||
    lowerLabel.includes("daily") ||
    (lowerLabel.includes("jour") && !lowerLabel.includes("7"));

  const isMacro =
    lowerLabel.includes("protein") ||
    lowerLabel.includes("protéine") ||
    lowerLabel.includes("carb") ||
    lowerLabel.includes("glucide") ||
    lowerLabel.includes("fat") ||
    lowerLabel.includes("lipide");

  return isDailyIntake && isMacro;
};

interface InsightBarProps {
  insight: NewInsight;
  onNutritionDetailClick?: (macroType?: string) => void;
  isPriorityView?: boolean;
}

const InsightBar = ({ insight, onNutritionDetailClick, isPriorityView }: InsightBarProps) => {
  const { t } = useTranslation("common");
  const { t: tNutrition } = useTranslation("nutrition");
  const mapInsightStatusToLabelAndClassnames: Record<
    InsightStatus,
    { label: string; textColor: string; backgroundColor: string }
  > = {
    veryLow: {
      label: t("insightStatus.veryLow"),
      textColor: "text-[#FE4A4ACC]",
      backgroundColor: "bg-[#FE4A4ACC]",
    },
    low: {
      label: t("insightStatus.low"),
      textColor: "text-[#F7E473]",
      backgroundColor: "bg-[#F7E473]",
    },
    good: {
      label: t("insightStatus.good"),
      textColor: "text-[#6AFFC4]",
      backgroundColor: "bg-[#6AFFC4]",
    },
    high: {
      label: t("insightStatus.high"),
      textColor: "text-[#F7E473]",
      backgroundColor: "bg-[#F7E473]",
    },
    veryHigh: {
      label: t("insightStatus.veryHigh"),
      textColor: "text-[#FE4A4ACC]",
      backgroundColor: "bg-[#FE4A4ACC]",
    },
  } as const;

  const maxValue = insight.maximum;

  const getPositions = () => {
    const valuePosition = (Math.min(insight.value ?? 0, maxValue) / maxValue) * 100;

    const veryLowPosition = insight.tresholdTooLow
      ? (insight.tresholdTooLow / maxValue) * 100
      : undefined;

    const lowPosition = insight.tresholdLow ? (insight.tresholdLow / maxValue) * 100 : undefined;

    const highPosition = insight.tresholdHigh ? (insight.tresholdHigh / maxValue) * 100 : undefined;

    const veryHighPosition = insight.tresholdTooHigh
      ? (insight.tresholdTooHigh / maxValue) * 100
      : undefined;

    const veryLowTextPosition = veryLowPosition ? veryLowPosition / 2 : undefined;
    const lowTextPosition = lowPosition ? ((veryLowPosition ?? 0) + lowPosition) / 2 : undefined;
    const highTextPosition = highPosition
      ? highPosition +
        (veryHighPosition ? (veryHighPosition - highPosition) / 2 : (100 - highPosition) / 2)
      : undefined;
    const veryHighTextPosition = veryHighPosition
      ? veryHighPosition + (100 - veryHighPosition) / 2
      : undefined;

    const leftOptimal = lowPosition ?? veryLowPosition ?? 0;
    const rightOptimal = highPosition ?? veryHighPosition ?? 100;
    const optimalTextPosition = (leftOptimal + rightOptimal) / 2;

    return {
      valuePosition,
      veryLowPosition,
      lowPosition,
      highPosition,
      veryHighPosition,
      veryLowTextPosition,
      lowTextPosition,
      highTextPosition,
      veryHighTextPosition,
      optimalTextPosition,
    };
  };

  const {
    valuePosition,
    veryLowPosition,
    lowPosition,
    highPosition,
    veryHighPosition,
    veryLowTextPosition,
    lowTextPosition,
    highTextPosition,
    veryHighTextPosition,
    optimalTextPosition,
  } = getPositions();

  const status = getInsightStatus(insight);
  const labelAndClassnames = mapInsightStatusToLabelAndClassnames[status];
  const isAnalytic =
    insight.tresholdHigh ||
    insight.tresholdLow ||
    insight.tresholdTooHigh ||
    insight.tresholdTooLow;

  const categoryConfig: Record<NewInsight["type"], { icon: LucideIcon; label: string }> = {
    health: { icon: HeartIcon, label: t("category.health") },
    sleep: { icon: MoonIcon, label: t("category.sleep") },
    nutrition: { icon: AppleIcon, label: t("category.nutrition") },
    activity: { icon: ActivityIcon, label: t("category.activity") },
  };

  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex-1" />
      <div className="pb-8">
        <div className="text-base font-medium text-gray-200 flex flex-wrap items-end gap-x-2 gap-y-2 pb-3">
          <span>
            {insight.label}
            {insight.description && (
              <span className="group relative inline-flex items-center ml-2 flex-shrink-0">
                <InfoIcon className="size-4 text-gray-400 hover:text-gray-600 cursor-help translate-y-[2px]" />
                <div className="absolute font-normal top-1/2 -translate-y-1/2 left-full ml-2 px-3 py-2 bg-[#142836fc] text-gray-100 text-xs rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 whitespace-normal z-10 w-[200px] shadow-lg">
                  {insight.description}
                </div>
              </span>
            )}
          </span>
          {isMacronutrientInsight(insight) && onNutritionDetailClick && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const macroType = getMacroTypeFromLabel(insight.label);
                onNutritionDetailClick(macroType);
              }}
              className="p-1 hover:bg-gray-600 rounded transition-colors"
              title={tNutrition("viewNutritionDetails")}
            >
              <SearchIcon className="size-4 text-gray-400 hover:text-gray-200" />
            </button>
          )}
        </div>
        {isPriorityView && insight.priority !== null && insight.priority !== undefined && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1.5 rounded-lg font-normal text-xs bg-purple-600/10 text-fuchsia-300 border border-purple-400/20">
              {t("priority")} {insight.priority}
            </span>
            {(() => {
              const categoryInfo = categoryConfig[insight.type] || {
                icon: InfoIcon,
                label: insight.type,
              };
              const CategoryIcon = categoryInfo.icon;
              return (
                <span className="px-3 py-1.5 rounded-lg font-normal text-xs bg-gray-700/30 text-white/70 border border-gray-600/50 flex items-center gap-1.5">
                  <CategoryIcon className="size-3 opacity-70" />
                  {categoryInfo.label}
                </span>
              );
            })()}
          </div>
        )}
      </div>
      <div className="relative h-16 card p-0 w-full rounded">
        <div
          className={twMerge(
            "absolute h-full w-1",
            labelAndClassnames.backgroundColor,
            insight.value === null && "bg-gray-400",
          )}
          style={{ left: `${valuePosition}%` }}
        />
        {!!isAnalytic && (
          <div
            className={twMerge(
              "absolute -bottom-7 text-xs text-nowrap text-white",
              insight.value === null && "text-gray-200",
            )}
            style={{
              left: `${valuePosition}%`,
              transform: "translateX(-50%) rotate(45deg)",
            }}
          >
            {insight.value === null ? "No data" : Math.round(insight.value * 100) / 100}
          </div>
        )}
        <Indicator
          label="Optimal"
          textPosition={optimalTextPosition}
          position={!isAnalytic ? 50 : undefined}
        />
        {isAnalytic && veryLowPosition ? (
          <Indicator
            position={veryLowPosition}
            label={t("insightStatus.veryLow")}
            value={insight.tresholdTooLow ?? undefined}
            textPosition={veryLowTextPosition}
          />
        ) : null}
        {isAnalytic && lowPosition ? (
          <Indicator
            position={lowPosition}
            label={t("insightStatus.low")}
            value={insight.tresholdLow ?? undefined}
            textPosition={lowTextPosition}
          />
        ) : null}

        {isAnalytic && highPosition ? (
          <Indicator
            position={highPosition}
            label={t("insightStatus.high")}
            value={insight.tresholdHigh ?? undefined}
            textPosition={highTextPosition}
          />
        ) : null}

        {isAnalytic && veryHighPosition ? (
          <Indicator
            position={veryHighPosition}
            label={t("insightStatus.veryHigh")}
            value={insight.tresholdTooHigh ?? undefined}
            textPosition={veryHighTextPosition}
          />
        ) : null}
      </div>
    </div>
  );
};

const Indicator = ({
  position,
  textPosition,
  label,
  value,
}: {
  position?: number;
  textPosition?: number;
  label: string;
  value?: number;
}) => {
  return (
    <>
      {position && (
        <>
          <div
            className="absolute h-full w-0.5"
            style={{
              left: `${position}%`,
              backgroundImage: "linear-gradient(to bottom, #76989C 50%, transparent 50%)",
              backgroundSize: "1px 8px",
              backgroundColor: "transparent",
            }}
          />
          <p
            className="absolute -bottom-7 text-xs text-[#76989C] text-nowrap"
            style={{
              left: `${position}%`,
              transform: "translateX(-50%) rotate(45deg)",
              transformOrigin: "center",
            }}
          >
            {value ? Math.round(value * 100) / 100 : ""}
          </p>
        </>
      )}
      {textPosition && (
        <p
          className={twMerge(
            "absolute -top-6 text-xs text-[#76989C] text-nowrap font-normal",
            label === "Optimal" && "text-white font-semibold",
          )}
          style={{ left: `${textPosition}%`, transform: "translateX(-50%)" }}
        >
          {label}
        </p>
      )}
    </>
  );
};

export default InsightBar;
