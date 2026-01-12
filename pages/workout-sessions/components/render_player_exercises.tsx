import type { APIWorkoutHistory } from "../../../types/workout.types";
import type { ReactElement } from "react";
import {
  getPlayerModifications,
  groupAndSortExercisesByName,
  sortExercisesByOrder,
  isNewExercise,
} from "../utils/player_modifications";
import type { SupportedLanguage } from "../../../utils/language_config";

interface RenderPlayerExercisesProps {
  baseExercises: APIWorkoutHistory["exercises"];
  playerExerciseSets: APIWorkoutHistory["exercises"];
  currentLanguage: SupportedLanguage;
  renderExercise: (
    exerciseName: string,
    sets: APIWorkoutHistory["exercises"],
    options?: {
      modifications?: ReturnType<typeof getPlayerModifications>["modifications"];
      isNewExercise?: boolean;
      variant?: "simple" | "withModifications";
    },
  ) =>  ReactElement;
}

export const RenderPlayerExercises = ({
  baseExercises,
  playerExerciseSets,
  currentLanguage,
  renderExercise,
}: RenderPlayerExercisesProps) => {
  const { modifications, newExercises } = getPlayerModifications({
    baseExercises,
    playerExerciseSets,
    language: currentLanguage,
  });

  const sortedExercises = Array.from(
    groupAndSortExercisesByName(playerExerciseSets, currentLanguage),
  ).sort(sortExercisesByOrder);

  return (
    <>
      {sortedExercises.map(([exerciseName, sets]) =>
        renderExercise(exerciseName, sets, {
          modifications,
          isNewExercise: isNewExercise(sets[0].exercise, newExercises),
          variant: "withModifications",
        }),
      )}
    </>
  );
};

