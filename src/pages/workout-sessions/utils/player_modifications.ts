import { getAllModifications } from "./detect_player_modifications";
import type { APIExerciseSet, PlayerModification, ExerciseName } from "../../../types/workout.types";
import { getLocalizedName, type SupportedLanguage } from "../../../utils/language_config";
import type { GetPlayerModificationsProps } from "../types/workout_modifications.types";

export const groupExercisesByName = (exercises: APIExerciseSet[], language: SupportedLanguage): Map<string, APIExerciseSet[]> => {
  const grouped = new Map<string, APIExerciseSet[]>();
  exercises.forEach((exercise) => {
    const name = getLocalizedName(exercise.exercise, language);
    const sets = grouped.get(name) ?? [];
    sets.push(exercise);
    grouped.set(name, sets);
  });
  return grouped;
};

export const getSetChanges = (playerSet: APIExerciseSet, baseSet: APIExerciseSet | undefined): PlayerModification["changes"] => {
  const changes: PlayerModification["changes"] = {};
  if (!baseSet) return changes;
  if (playerSet.reps !== baseSet.reps) changes.reps = { original: baseSet.reps ?? null, modified: playerSet.reps ?? null };
  if (playerSet.weight !== baseSet.weight) changes.weight = { original: baseSet.weight ?? null, modified: playerSet.weight ?? null };
  if (playerSet.time !== baseSet.time) changes.time = { original: baseSet.time ?? null, modified: playerSet.time ?? null };
  return changes;
};

export const getSortedSets = (sets: APIExerciseSet[]): APIExerciseSet[] =>
  [...sets].sort((a, b) => (a.setOrder ?? 0) - (b.setOrder ?? 0));

export const sortExercisesByOrder = <T extends APIExerciseSet[]>([, setsA]: [string, T], [, setsB]: [string, T]) =>
  (setsA[0]?.order ?? 0) - (setsB[0]?.order ?? 0);

export const groupAndSortExercisesByName = (
  exercises: APIExerciseSet[],
  language: SupportedLanguage,
): Map<string, APIExerciseSet[]> => {
  const grouped = groupExercisesByName(exercises, language);
  grouped.forEach((sets, name) => grouped.set(name, getSortedSets(sets)));
  return grouped;
};

export const findModificationForSet = (
  exerciseName: ExerciseName,
  setIndex: number,
  modifications: PlayerModification[],
): PlayerModification | undefined =>
  modifications.find((mod) => mod.exerciseName.nameEn === exerciseName.nameEn && mod.setIndex === setIndex);

export const isNewExercise = (
  exerciseName: ExerciseName,
  newExercises: Array<{ exerciseName: ExerciseName }>,
): boolean => newExercises.some((ne) => ne.exerciseName.nameEn === exerciseName.nameEn);

export const getPlayerModifications = ({
  baseExercises,
  playerExerciseSets,
  language,
}: GetPlayerModificationsProps) => {
  const { modifications, deletedExercises, newExercises } = getAllModifications({
    baseExercises,
    playerExerciseSets,
    language,
  });
  return {
    modifications,
    deletedExercises,
    newExercises,
    hasModifications: modifications.length > 0,
    hasDeletedExercises: deletedExercises.length > 0,
    hasNewExercises: newExercises.length > 0,
  };
};

