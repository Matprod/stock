import type { APIExerciseSet, ExerciseName } from "../../../types/workout.types";
import type { SupportedLanguage } from "../../../utils/language_config";

export interface GetDeletedExerciseModificationsProps {
  baseExercisesByName: Map<string, APIExerciseSet[]>;
  playerExercisesByName: Map<string, APIExerciseSet[]>;
}

export interface GetNewExercisesProps {
  baseExercisesByName: Map<string, APIExerciseSet[]>;
  playerExercisesByName: Map<string, APIExerciseSet[]>;
}

export interface CompareSetsProps {
  exerciseName: ExerciseName;
  index: number;
  baseSet: APIExerciseSet | undefined;
  playerSet: APIExerciseSet | undefined;
}

export interface GetSetModificationsProps {
  exerciseName: ExerciseName;
  baseSets: APIExerciseSet[];
  playerSets: APIExerciseSet[];
}

export interface GetPlayerModificationsProps {
  baseExercises: APIExerciseSet[];
  playerExerciseSets: APIExerciseSet[];
  language: SupportedLanguage;
}

export interface GetAllModificationsProps {
  baseExercises: APIExerciseSet[];
  playerExerciseSets: APIExerciseSet[];
  language: SupportedLanguage;
}

