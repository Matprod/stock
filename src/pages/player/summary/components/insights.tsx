import { useState } from "react";
import { ChatBot } from "../../../../components/player/chat_bot";
import type { NewInsight } from "../../../../types/insight.types";
import InsightBar from "./insight_bar";
import { useTranslation } from "react-i18next";
import { useUserPreferencesStore } from "../../../../store/user-preferences-store";
import { Select } from "../../../../components/forms/select";

interface InsightsProps {
  insights: Array<NewInsight>;
  playerId: number;
  category: "injury" | "performance";
  onNutritionDetailClick?: () => void;
  type?: string;
  prioritySortBy?: "priority-asc" | "priority-desc" | "category";
  onPrioritySortChange?: (value: "priority-asc" | "priority-desc" | "category") => void;
}

export const InsightsSection = ({
  insights,
  playerId,
  category,
  onNutritionDetailClick,
  type,
  prioritySortBy,
  onPrioritySortChange,
}: InsightsProps) => {
  const { isChatOpen, setIsChatOpen } = useUserPreferencesStore();
  const [initialQuestion, setInitialQuestion] = useState<string | null>(null);
  const { t } = useTranslation("chatbot");
  const { t: tSummary } = useTranslation("summary");

  const handleInsightClick = (label: string) => {
    setInitialQuestion(t("featureImportance", { feature: label }));
    setIsChatOpen(true);
  };

  const sortOptions = [
    { value: "priority-asc", label: tSummary("sortBy.priorityAsc") },
    { value: "priority-desc", label: tSummary("sortBy.priorityDesc") },
    { value: "category", label: tSummary("sortBy.category") },
  ] as const;

  return (
    <>
      <div className="bg-[#252d3b] rounded-2xl shadow-md border border-[#3a4454] p-10 pt-8 w-full">
        {type === "priority" && (
          <div className="flex gap-4 justify-between mb-4">
            <p className="text-base font-normal text-white/50">
              {tSummary("priorityInsights", { category: tSummary(`tabs.${category}`) })}
            </p>
            {prioritySortBy && onPrioritySortChange && (
              <Select<(typeof sortOptions)[number], "priority-asc" | "priority-desc" | "category">
                value={prioritySortBy}
                onValueChange={onPrioritySortChange}
                options={sortOptions}
                getOptionLabel={(option) => option.label}
                getOptionValue={(option) => option.value}
                className="w-[200px] rounded-ml"
              />
            )}
          </div>
        )}
        <div className="grid gap-x-20 gap-y-20 items-start justify-start auto-rows-min grid-cols-[repeat(auto-fit,minmax(max(12rem,calc(50%-2.5rem)),1fr))]">
          {insights.map((insight, index) => (
            <button
              type="button"
              key={`${insight.label}-${index}`}
              className="w-full h-full flex"
              onClick={() => handleInsightClick(insight.label)}
            >
              <InsightBar
                insight={insight}
                onNutritionDetailClick={onNutritionDetailClick}
                isPriorityView={type === "priority"}
              />
            </button>
          ))}
        </div>
      </div>
      <ChatBot
        isOpen={isChatOpen}
        setIsOpen={setIsChatOpen}
        playerId={playerId}
        category={category}
        initialQuestion={initialQuestion}
        setInitialQuestion={setInitialQuestion}
      />
    </>
  );
};
