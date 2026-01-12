import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  NutritionDetail,
  MacronutrientType,
  MealsFilled,
} from "../../../../types/nutrition.types";
import { getMacroUnit, isMealFilled } from "../../../../utils/nutrition.utils";
import { twMerge } from "tailwind-merge";
interface PieChartProps {
  data: NutritionDetail;
  selectedMacro: MacronutrientType;
  expandedMeals: Set<number>;
  setExpandedMeals: React.Dispatch<React.SetStateAction<Set<number>>>;
  mealsFilled?: MealsFilled;
}

const CHART_COLORS = ["#1D4ED8", "#3B82F6", "#60A5FA", "#93C5FD", "#BFDBFE"];
const CHART_RADIUS = 50;
const CHART_CENTER = 50;
const toRadians = (degrees: number): number => {
  return (degrees * Math.PI) / 180;
};

export const PieChart = ({
  data,
  selectedMacro,
  expandedMeals,
  setExpandedMeals,
  mealsFilled,
}: PieChartProps) => {
  const { t } = useTranslation("nutrition");
  const macroLabel = t(`macronutrientLabels.${selectedMacro}`);
  const unit = getMacroUnit(selectedMacro);
  const [hoveredMeal, setHoveredMeal] = useState<string | null>(null);

  const chartData = useMemo(() => {
    const mealTranslations: Record<string, string> = {
      breakfast: t("meals.breakfast"),
      lunch: t("meals.lunch"),
      dinner: t("meals.dinner"),
      snack: t("meals.snack"),
      snackam: t("meals.snackAM"),
      snackpm: t("meals.snackPM"),
    };
    const key =
      `total${selectedMacro.charAt(0).toUpperCase() + selectedMacro.slice(1)}` as keyof NutritionDetail;
    const total = (data[key] as number) || 0;

    const mealMap = new Map<string, { ids: number[]; value: number; originalTypes: string[] }>();

    data.meals.forEach((meal) => {
      const mealKey = key as keyof typeof meal;
      const value = (meal[mealKey] as number) || 0;
      const normalizedType = meal.type.toLowerCase().trim();
      const groupKey =
        normalizedType === "snackam" || normalizedType === "snackpm" ? "snack" : normalizedType;
      if (!mealMap.has(groupKey)) {
        mealMap.set(groupKey, { ids: [], value: 0, originalTypes: [] });
      }

      const group = mealMap.get(groupKey)!;
      group.ids.push(meal.id);
      group.value += value;
      group.originalTypes.push(meal.type);
    });

    const orderedMeals = ["breakfast", "snack", "lunch", "dinner"];
    return Array.from(mealMap.entries())
      .sort(([a], [b]) => {
        const indexA = orderedMeals.indexOf(a);
        const indexB = orderedMeals.indexOf(b);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      })
      .map(([type, group], index) => ({
        id: group.ids[0],
        name: mealTranslations[type.toLowerCase().replace(" ", "")] || type,
        value: group.value,
        percentage: total > 0 ? Math.round((group.value / total) * 100) : 0,
        color: CHART_COLORS[index % CHART_COLORS.length],
        allIds: group.ids,
        originalTypes: group.originalTypes,
      }));
  }, [data, selectedMacro, t]);

  const totalValue = useMemo(
    () => chartData.reduce((sum, item) => sum + item.value, 0),
    [chartData],
  );

  const handleSliceClick = (mealId: number) => {
    const mealItem = chartData.find((item) => item.id === mealId);
    if (!mealItem) return;

    const allIds = mealItem.allIds || [mealId];
    setExpandedMeals((prev) => {
      const next = new Set(prev);
      const shouldExpand = !allIds.some((id) => next.has(id));
      allIds.forEach((id: number) => {
        shouldExpand ? next.add(id) : next.delete(id);
      });
      return next;
    });
  };

  const createPiePath = (index: number) => {
    const startAngle = chartData
      .slice(0, index)
      .reduce((sum, prev) => sum + (prev.value / totalValue) * 360, 0);
    const endAngle = startAngle + (chartData[index].value / totalValue) * 360;

    const x1 = CHART_CENTER + CHART_RADIUS * Math.cos(toRadians(startAngle));
    const y1 = CHART_CENTER + CHART_RADIUS * Math.sin(toRadians(startAngle));
    const x2 = CHART_CENTER + CHART_RADIUS * Math.cos(toRadians(endAngle));
    const y2 = CHART_CENTER + CHART_RADIUS * Math.sin(toRadians(endAngle));
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;

    return `M ${CHART_CENTER} ${CHART_CENTER} L ${x1} ${y1} A ${CHART_RADIUS} ${CHART_RADIUS} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  };

  const calculateLabelPosition = (index: number) => {
    const startAngle = chartData
      .slice(0, index)
      .reduce((sum, prev) => sum + (prev.value / totalValue) * 360, 0);
    const endAngle = startAngle + (chartData[index].value / totalValue) * 360;
    const midAngle = (startAngle + endAngle) / 2;

    const percentageRadius = CHART_RADIUS + 12;
    const percentageX = CHART_CENTER + percentageRadius * Math.cos(toRadians(midAngle));
    const percentageY = CHART_CENTER + percentageRadius * Math.sin(toRadians(midAngle));

    const lineRadius = CHART_RADIUS - 1;
    const lineX = CHART_CENTER + lineRadius * Math.cos(toRadians(midAngle));
    const lineY = CHART_CENTER + lineRadius * Math.sin(toRadians(midAngle));

    return {
      percentage: { x: percentageX, y: percentageY },
      line: { x: lineX, y: lineY },
    };
  };

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        {t("noDataForMacro")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center p-12">
        <div className="relative w-72 h-72">
          <svg viewBox="-20 0 140 100" className="w-full h-full">
            {chartData.map((item, index) => {
              const labelPos = calculateLabelPosition(index);
              const isExpanded =
                item.allIds?.some((id) => expandedMeals.has(id)) ?? expandedMeals.has(item.id);
              const isFullCircle = chartData.length === 1;

              return (
                <g key={item.name}>
                  {isFullCircle ? (
                    <circle
                      cx={CHART_CENTER}
                      cy={CHART_CENTER}
                      r={CHART_RADIUS}
                      fill={item.color}
                      onClick={() => handleSliceClick(item.id)}
                      onMouseEnter={() => setHoveredMeal(item.name)}
                      onMouseLeave={() => setHoveredMeal(null)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleSliceClick(item.id);
                        }
                      }}
                      className={`hover:opacity-80 transition-all cursor-pointer ${
                        isExpanded ? "opacity-100 drop-shadow-lg" : "opacity-90"
                      }`}
                      style={{ filter: isExpanded ? "brightness(1.2)" : "none", outline: "none" }}
                    />
                  ) : (
                    <path
                      d={createPiePath(index)}
                      fill={item.color}
                      onClick={() => handleSliceClick(item.id)}
                      onMouseEnter={() => setHoveredMeal(item.name)}
                      onMouseLeave={() => setHoveredMeal(null)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleSliceClick(item.id);
                        }
                      }}
                      className={`hover:opacity-80 transition-all cursor-pointer ${
                        isExpanded ? "opacity-100 drop-shadow-lg" : "opacity-90"
                      }`}
                      style={{ filter: isExpanded ? "brightness(1.2)" : "none", outline: "none" }}
                    />
                  )}
                  <line
                    x1={labelPos.line.x}
                    y1={labelPos.line.y}
                    x2={labelPos.percentage.x}
                    y2={labelPos.percentage.y}
                    stroke="white"
                    strokeWidth="0.5"
                    opacity="0.6"
                  />
                  <text
                    x={labelPos.percentage.x}
                    y={labelPos.percentage.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-[6px] fill-white font-medium pointer-events-none"
                  >
                    {item.percentage}%
                  </text>
                </g>
              );
            })}
          </svg>
          {hoveredMeal && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
              <div className="bg-gray-900/95 text-white px-4 py-2 rounded-lg shadow-xl border border-gray-700">
                <div className="text-sm font-medium">{hoveredMeal}</div>
                {(() => {
                  const isFilled = isMealFilled(hoveredMeal, mealsFilled);

                  return (
                    <div
                      className={twMerge(
                        "text-xs mt-1",
                        isFilled ? "text-[#6AFFC4]" : "text-gray-400",
                      )}
                    >
                      {isFilled ? t("completed") : t("notCompleted")}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-1">
        {chartData.map((item) => (
          <div key={item.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-gray-300">{item.name}</span>
            </div>
            <div className="text-xs text-gray-400">
              {item.value.toFixed(1)}
              {unit}
            </div>
          </div>
        ))}
      </div>

      <div className="pt-3 border-t border-gray-600">
        <div className="flex justify-between items-center">
          <span className="text-xs font-medium text-white">{t("total")}</span>
          <span className="text-xs font-medium text-white">
            {totalValue.toFixed(1)}
            {unit} {macroLabel}
          </span>
        </div>
      </div>
    </div>
  );
};