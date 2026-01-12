import { useTranslation } from "react-i18next";
import type { MealsFilled } from "../../../../types/nutrition.types";
import { twMerge } from "tailwind-merge";

interface MealsStatusProps {
  mealsFilled: MealsFilled;
}

const MEAL_CONFIG = [
  { key: "breakfast" },
  { key: "snackAM" },
  { key: "lunch" },
  { key: "snackPM" },
  { key: "dinner" },
] as const;

export const MealsStatus = ({ mealsFilled }: MealsStatusProps) => {
  const { t } = useTranslation("nutrition");

  const getStatusStyles = (isFilled: boolean) => {
    if (isFilled) {
      return {
        bg: "bg-green-500/20",
        border: "border-[#6AFFC4]",
        text: "text-[#6AFFC4]",
      };
    }
    return {
      bg: "bg-gray-800",
      border: "border-gray-600",
      text: "text-gray-400",
    };
  };

  return (
    <div className="bg-[#252d3b] rounded-2xl shadow-md border border-[#3a4454] p-6">
      <h2 className="text-base font-medium text-gray-200 mb-4">{t("mealsStatus")}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {MEAL_CONFIG.map(({ key }) => {
          const isFilled = mealsFilled[key as keyof MealsFilled];
          const styles = getStatusStyles(isFilled);
          return (
            <div
              key={key}
              className={twMerge(
                "flex flex-col gap-1 p-3 rounded-lg border",
                styles.bg,
                styles.border,
              )}
            >
              <div className="text-sm font-medium text-white">{t(`meals.${key}`)}</div>
              <div className={twMerge("text-xs font-medium", styles.text)}>
                {isFilled ? t("completed") : t("notCompleted")}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
