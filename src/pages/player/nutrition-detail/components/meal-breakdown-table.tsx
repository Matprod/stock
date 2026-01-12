import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import type { NutritionDetail, MacronutrientType } from "../../../../types/nutrition.types";
import { getMacroValue, getMacroUnit } from "../../../../utils/nutrition.utils";
import { getLocalizedName, getSupportedLanguage } from "../../../../utils/language_config";
import type { Dispatch, SetStateAction } from "react";

interface MealBreakdownTableProps {
  data: NutritionDetail;
  selectedMacro: MacronutrientType;
  expandedMeals: Set<number>;
  setExpandedMeals: Dispatch<SetStateAction<Set<number>>>;
}

export const MealBreakdownTable = ({
  data,
  selectedMacro,
  expandedMeals,
  setExpandedMeals,
}: MealBreakdownTableProps) => {
  const { t, i18n } = useTranslation("nutrition");
  const macroLabel = t(`macronutrientLabels.${selectedMacro}`);
  const unit = getMacroUnit(selectedMacro);
  const currentLanguage = getSupportedLanguage(i18n.language);

  const getTranslatedMealName = useMemo(
    () => (mealType: string) => {
      const normalizedType = mealType.toLowerCase().replace(" ", "");
      const mealTranslations: Record<string, string> = {
        breakfast: t("meals.breakfast"),
        lunch: t("meals.lunch"),
        dinner: t("meals.dinner"),
        snack: t("meals.snack"),
        snackam: t("meals.snackAM"),
        snackpm: t("meals.snackPM"),
      };
      return mealTranslations[normalizedType] || mealType;
    },
    [t],
  );

  const toggleMeal = (mealId: number) => {
    setExpandedMeals((prev) => {
      const next = new Set(prev);
      next.has(mealId) ? next.delete(mealId) : next.add(mealId);
      return next;
    });
  };

  if (data.meals.length === 0) {
    return <div className="text-center text-gray-400 py-6">{t("noMealsRecorded")}</div>;
  }

  return (
    <div className="space-y-4">
      {data.meals.map((meal) => {
        const isExpanded = expandedMeals.has(meal.id);

        return (
          <div key={meal.id} className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleMeal(meal.id)}
                  className="p-1.5 h-7 w-7"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </Button>
                <div>
                  <h3 className="text-base font-medium text-white">
                    {getTranslatedMealName(meal.type)}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {t("total")} {macroLabel}: {getMacroValue(meal, selectedMacro).toFixed(1)}
                    {unit}
                  </p>
                </div>
              </div>
            </div>

            {isExpanded && (
              <div className="mt-4 space-y-2">
                <div className="text-sm text-gray-400 mb-3">{t("foodsConsumed")}:</div>
                {meal.foods.length === 0 ? (
                  <div className="text-sm text-gray-400 text-center py-4">
                    {t("noFoodsRecorded")}
                  </div>
                ) : (
                  meal.foods.map((food) => {
                    const localizedName = getLocalizedName(food, currentLanguage) || food.name;
                    return (
                      <div
                        key={food.id}
                        className="flex items-center justify-between py-3 px-3 bg-gray-700 rounded"
                      >
                        <div className="flex-1">
                          <div className="text-sm text-white">{localizedName}</div>
                          <div className="text-sm text-gray-400">
                            {t("portion")}: {food.portion}
                          </div>
                        </div>
                        <div className="text-sm text-gray-300 font-medium">
                          {getMacroValue(food, selectedMacro).toFixed(1)}
                          {unit}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}

      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="text-base font-medium text-white">
            {t("dailyTotal")} {macroLabel}
          </span>
          <span className="text-base font-medium text-white">
            {getMacroValue(data, selectedMacro).toFixed(1)}
            {unit}
          </span>
        </div>
      </div>
    </div>
  );
};
