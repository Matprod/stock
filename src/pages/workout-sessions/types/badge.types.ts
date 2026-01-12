import type { PlayerModification, APIExerciseSet } from "../../../types/workout.types";

export type BadgeVariant =
  | "value-change"
  | "time-change"
  | "success"
  | "danger"
  | "info"
  | "secondary"
  | "destructive";

export interface BadgeProps {
  variant: BadgeVariant;
  className?: string;
  label?: string;
  original?: number | string | null;
  modified?: number | string | null;
  unit?: string;
  message?: string;
  count?: number;
  countText?: string;
  modification?: PlayerModification;
}

export interface PlayerModificationBadgesProps {
  baseExercises: APIExerciseSet[];
  playerExerciseSets: APIExerciseSet[];
}

export interface ModificationBadgeProps {
  modification: PlayerModification;
}

