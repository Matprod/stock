import type {
  MacronutrientType,
  NutritionDetail,
  MealsFilled,
} from "../../../../types/nutrition.types";
import { TabsContent } from "../../../../components/ui/tabs";
import { NutritionTabs } from "./nutrition-tabs";
import { NutritionCards } from "./nutrition-cards";

interface NutritionContentProps {
  selectedMacro: MacronutrientType;
  onMacroChange: (macro: MacronutrientType) => void;
  nutritionData: NutritionDetail;
  expandedMeals: Set<number>;
  setExpandedMeals: React.Dispatch<React.SetStateAction<Set<number>>>;
  mealsFilled?: MealsFilled;
}

export const NutritionContent = ({
  selectedMacro,
  onMacroChange,
  nutritionData,
  expandedMeals,
  setExpandedMeals,
  mealsFilled,
}: NutritionContentProps) => {
  return (
    <>
      <NutritionTabs onMacroChange={onMacroChange} />

      <TabsContent value={selectedMacro}>
        <NutritionCards
          nutritionData={nutritionData}
          selectedMacro={selectedMacro}
          expandedMeals={expandedMeals}
          setExpandedMeals={setExpandedMeals}
          mealsFilled={mealsFilled}
        />
      </TabsContent>
    </>
  );
};
