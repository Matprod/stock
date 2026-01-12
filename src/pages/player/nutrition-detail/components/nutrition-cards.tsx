import { useTranslation } from "react-i18next";
import type {
  MacronutrientType,
  NutritionDetail,
  MealsFilled,
} from "../../../../types/nutrition.types";
import { PieChart } from "./pie-chart";
import { MealBreakdownTable } from "./meal-breakdown-table";
import { MealsStatus } from "./meals-status";

interface NutritionCardsProps {
  nutritionData: NutritionDetail;
  selectedMacro: MacronutrientType;
  expandedMeals: Set<number>;
  setExpandedMeals: React.Dispatch<React.SetStateAction<Set<number>>>;
  mealsFilled?: MealsFilled;
}

export const NutritionCards = ({
  nutritionData,
  selectedMacro,
  expandedMeals,
  setExpandedMeals,
  mealsFilled,
}: NutritionCardsProps) => {
  const { t } = useTranslation("nutrition");

  return (
    <div className="border border-[#4c648a] rounded-2xl p-4">
      {mealsFilled && (
        <div className="mb-6">
          <MealsStatus mealsFilled={mealsFilled} />
        </div>
      )}

      <div className="flex gap-6 w-full items-start">
        <div className="w-2/5 flex-shrink-0 bg-[#252d3b] rounded-2xl shadow-md border border-[#3a4454] p-6">
          <h2 className="text-base font-medium text-gray-200 mb-4">
            {t("distributionByMeal")} - {t(`macronutrientLabels.${selectedMacro}`)}
          </h2>
          <PieChart
            data={nutritionData}
            selectedMacro={selectedMacro}
            expandedMeals={expandedMeals}
            setExpandedMeals={setExpandedMeals}
            mealsFilled={mealsFilled}
          />
        </div>

        <div className="flex-1 bg-[#252d3b] rounded-2xl shadow-md border border-[#3a4454] p-6">
          <h2 className="text-base font-medium text-gray-200 mb-4">
            {t("breakdownByMeal")} - {t(`macronutrientLabels.${selectedMacro}`)}
          </h2>
          <MealBreakdownTable
            data={nutritionData}
            selectedMacro={selectedMacro}
            expandedMeals={expandedMeals}
            setExpandedMeals={setExpandedMeals}
          />
        </div>
      </div>
    </div>
  );
};
