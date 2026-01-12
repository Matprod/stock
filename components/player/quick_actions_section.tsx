import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { useUserPreferencesStore } from "../../store/user-preferences-store";
import type { IChatBotQuestion } from "../../types/chatbot.types";

interface QuickActionsSectionProps {
  questions: IChatBotQuestion[];
  onQuestionClick: (question: string) => void;
}

export const QuickActionsSection = ({ questions, onQuestionClick }: QuickActionsSectionProps) => {
  const { t } = useTranslation("chatbot");
  const { isQuickActionsExpanded, setIsQuickActionsExpanded } = useUserPreferencesStore();

  if (questions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setIsQuickActionsExpanded(!isQuickActionsExpanded)}
        className="flex items-center gap-2 opacity-40 hover:opacity-60 transition-opacity duration-200"
      >
        <p className="text-xs font-normal uppercase tracking-wide text-white">
          {t("quickActions")}
        </p>
        <ChevronDown
          className={cn(
            "`w-4 h-4 text-white transition-transform duration-200 $",
            isQuickActionsExpanded && "-rotate-90",
          )}
        />
      </button>
      {isQuickActionsExpanded && (
        <div className="flex flex-wrap gap-2 mt-1">
          {questions.map((question, index) => (
            <ActionChip key={index} onClick={() => onQuestionClick(question.question)}>
              {question.title}
            </ActionChip>
          ))}
        </div>
      )}
    </div>
  );
};

interface ActionChipProps {
  onClick: () => void;
  children: ReactNode;
}

const ActionChip = ({ onClick, children }: ActionChipProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-start rounded-full bg-white/5 px-4 py-2 text-left text-[13px] font-light leading-[20px] text-white/90 transition-all duration-200 hover:bg-white/10 hover:scale-[1.02]"
    >
      {children}
    </button>
  );
};
