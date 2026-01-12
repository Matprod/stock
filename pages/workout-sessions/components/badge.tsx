import { getPlayerModifications } from "../utils/player_modifications";
import type {
  BadgeProps,
  BadgeVariant,
  PlayerModificationBadgesProps,
  ModificationBadgeProps,
} from "../types/badge.types";
import { useTranslation } from "react-i18next";
import { getLocalizedName, getSupportedLanguage } from "../../../utils/language_config";
import { twMerge } from "tailwind-merge";

const Badge = ({
  variant,
  className = "",
  label,
  original,
  modified,
  unit = "",
  message,
  count,
  countText,
  modification,
}: BadgeProps) => {
  const { t, i18n } = useTranslation("workout");
  const currentLanguage = getSupportedLanguage(i18n.language);
  
  const variantClasses: Record<BadgeVariant, string> = {
    "value-change": "bg-blue-500/20 text-blue-300 border-blue-500/30",
    "time-change": "bg-blue-500/20 text-blue-300 border-blue-500/30",
    "success": "bg-green-500/20 text-green-300 border-green-500/30",
    "danger": "bg-red-500/20 text-red-300 border-red-500/30",
    "info": "bg-[#5AC5F2]/20 text-[#5AC5F2] border-[#5AC5F2]/30",
    "secondary": "bg-gray-500/20 text-gray-300 border-gray-500/30",
    "destructive": "bg-red-500/20 text-red-300 border-red-500/30",
  } as const;

  const getContent = () => {
    if ((variant === "value-change" || variant === "time-change") && label && original !== undefined && modified !== undefined) {
      return (
        <>
          {label}:
          <strong>
            {original ?? "—"}
            {variant === "value-change" ? `${unit} → ${modified ?? "—"}${unit}` : ` → ${modified ?? "—"}`}
          </strong>
        </>
      );
    }
    if (message) return <strong>{message}</strong>;
    if (count !== undefined && countText) return `${count} ${countText}`;
    if (modification) {
      const exerciseName = getLocalizedName(modification.exerciseName, currentLanguage);
      return <strong>{modification.setIndex === 0 ? `${exerciseName} ${t("modification.deletedExercise")}` : t("modification.deletedSeries")}</strong>;
    }
    return null;
  };

  return <div className={twMerge("px-1.5 py-0.5 rounded text-xs border flex items-center gap-1", variantClasses[variant], className)}>{getContent()}</div>;
};

export const ModificationBadge = ({ modification }: ModificationBadgeProps) => {
  const { t } = useTranslation("workout");
  const { changes } = modification;

  return (
    <div className="flex gap-2 text-xs ml-4 flex-wrap">
      {changes.reps && <Badge key="reps" variant="value-change" label={t("modification.reps")} original={changes.reps.original} modified={changes.reps.modified} />}
      {changes.weight && <Badge key="weight" variant="value-change" label={t("modification.weight")} original={changes.weight.original} modified={changes.weight.modified} unit="kg" />}
      {changes.time && <Badge key="time" variant="time-change" label={t("modification.time")} original={changes.time.original} modified={changes.time.modified} />}
      {modification.isNewSet && <Badge variant="info" message={`+ ${t("modification.newSet")}`} />}
      {modification.isDeletedSet && <Badge variant="danger" modification={modification} />}
    </div>
  );
};

export const PlayerModificationBadges = ({ baseExercises, playerExerciseSets }: PlayerModificationBadgesProps) => {
  const { t, i18n } = useTranslation("workout");
  const currentLanguage = getSupportedLanguage(i18n.language);
  const { modifications, deletedExercises } = getPlayerModifications({
    baseExercises,
    playerExerciseSets,
    language: currentLanguage,
  });

  return (
    <div className="flex gap-2 flex-wrap">
      {modifications.length > 0 && (
        <Badge
          variant="secondary"
          count={modifications.length}
          countText={modifications.length === 1 ? t("modification.modification_one") : t("modification.modification_other")}
          className="bg-blue-500/20 text-blue-300 border-blue-500/30"
        />
      )}
      {deletedExercises.map((deletedExercise, index) => (
        <Badge
          key={`deleted-${index}`}
          variant="destructive"
          className="bg-red-500/20 text-red-300 border-red-500/30"
          message={`${getLocalizedName(deletedExercise.exerciseName, currentLanguage)} ${t("modification.deletedExercise")}`}
        />
      ))}
    </div>
  );
};
