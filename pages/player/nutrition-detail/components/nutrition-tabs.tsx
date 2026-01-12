import { useTranslation } from "react-i18next";
import { TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import { MACRO_OPTIONS, type MacronutrientType } from "../../../../types/nutrition.types";

interface NutritionTabsProps {
  onMacroChange: (macro: MacronutrientType) => void;
}

export const NutritionTabs = ({ onMacroChange }: NutritionTabsProps) => {
  const { t } = useTranslation("nutrition");

  return (
    <div className="flex justify-between items-center mb-6 mt-4">
      <TabsList className="gap-x-8">
        {MACRO_OPTIONS.map((macro) => (
          <TabsTrigger
            key={macro}
            value={macro}
            onClick={() => onMacroChange(macro)}
            className="capitalize"
          >
            {t(`macros.${macro}`)}
          </TabsTrigger>
        ))}
      </TabsList>
    </div>
  );
};
