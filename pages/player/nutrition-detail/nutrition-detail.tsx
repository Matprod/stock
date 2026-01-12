import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMacroSelection } from "../../../hooks/useMacroSelection";
import { useNutritionData } from "../../../hooks/useNutritionData";
import { Tabs } from "../../../components/ui/tabs";
import { Loader } from "../../../components/ui/loader";
import { BackButton } from "../../../components/ui/back-button";
import { ErrorDisplay } from "../../../components/ui/error-display";
import { PageLayout } from "../../../components/ui/page-layout";
import { NutritionContent } from "./components/nutrition-content";

const NutritionDetailPage = () => {
  const { t } = useTranslation("nutrition");
  const { selectedMacro, setSelectedMacro } = useMacroSelection();
  const [expandedMeals, setExpandedMeals] = useState<Set<number>>(new Set());

  const { playerId, nutritionData, mealsFilled, isLoading, hasError, hasNoData } =
    useNutritionData();

  const renderContent = () => {
    if (isLoading) return <Loader />;

    if (hasError) {
      return (
        <ErrorDisplay 
          errorType="loading"
          showBackButton={true}
          backButtonTitle={t("title")}
        />
      );
    }

    if (hasNoData) {
      return (
        <div className="flex flex-col items-center gap-y-8">
          <BackButton title={t("title")} />
          <div className="text-center text-gray-400">{t("noData")}</div>
        </div>
      );
    }

    return (
      <Tabs value={selectedMacro} className="w-full">
        <NutritionContent
          selectedMacro={selectedMacro}
          onMacroChange={setSelectedMacro}
          nutritionData={nutritionData!}
          expandedMeals={expandedMeals}
          setExpandedMeals={setExpandedMeals}
          mealsFilled={mealsFilled}
        />
      </Tabs>
    );
  };

  return (
    <PageLayout
      header={
        !isLoading && !hasError && !hasNoData ? (
          <BackButton
            title={t("title")}
            to={playerId ? `/player/${playerId}/summary?type=nutrition&category=performance` : undefined}
          />
        ) : undefined
      }
    >
      {renderContent()}
    </PageLayout>
  );
};

export default NutritionDetailPage;
