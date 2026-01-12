import type { APIExerciseSet, PlayerModification, NewExercise } from "../../../types/workout.types";
import {
  groupExercisesByName,
  getSetChanges,
  getSortedSets,
} from "./player_modifications";
import type {
  GetDeletedExerciseModificationsProps,
  GetNewExercisesProps,
  CompareSetsProps,
  GetSetModificationsProps,
  GetPlayerModificationsProps,
  GetAllModificationsProps,
} from "../types/workout_modifications.types";

const getMissingExercises = <T>(
  sourceMap: Map<string, APIExerciseSet[]>,
  targetMap: Map<string, APIExerciseSet[]>,
  createItem: (sets: APIExerciseSet[]) => T,
): T[] => {
  const results: T[] = [];
  sourceMap.forEach((sets, exerciseName) => {
    if (!targetMap.get(exerciseName)?.length) results.push(createItem(sets));
  });
  return results;
};

export const getDeletedExerciseModifications = ({
  baseExercisesByName,
  playerExercisesByName,
}: GetDeletedExerciseModificationsProps): PlayerModification[] =>
  getMissingExercises(baseExercisesByName, playerExercisesByName, (sets) => ({
    exerciseName: sets[0].exercise,
    setIndex: 0,
    changes: {},
    isNewSet: false,
    isDeletedSet: true,
  }));

export const getNewExercises = ({
  baseExercisesByName,
  playerExercisesByName,
}: GetNewExercisesProps): NewExercise[] =>
  getMissingExercises(playerExercisesByName, baseExercisesByName, (sets) => ({
    exerciseName: sets[0].exercise,
  }));

const compareSets = ({
  exerciseName,
  index,
  baseSet,
  playerSet,
}: CompareSetsProps): PlayerModification | null => {
  if (!playerSet && baseSet)
    return { exerciseName, setIndex: index, changes: {}, isNewSet: false, isDeletedSet: true };
  if (!baseSet && playerSet)
    return { exerciseName, setIndex: index, changes: {}, isNewSet: true, isDeletedSet: false };
  if (playerSet && baseSet) {
    const changes = getSetChanges(playerSet, baseSet);
    if (Object.keys(changes).length > 0)
      return { exerciseName, setIndex: index, changes, isNewSet: false, isDeletedSet: false };
  }
  return null;
};

export const getSetModifications = ({
  exerciseName,
  baseSets,
  playerSets,
}: GetSetModificationsProps): PlayerModification[] => {
  const sortedBaseSets = getSortedSets(baseSets);
  const sortedPlayerSets = getSortedSets(playerSets);
  const maxLength = Math.max(sortedBaseSets.length, sortedPlayerSets.length);
  const modifications: PlayerModification[] = [];
  for (let index = 0; index < maxLength; index++) {
    const modification = compareSets({
      exerciseName,
      index,
      baseSet: sortedBaseSets[index],
      playerSet: sortedPlayerSets[index],
    });
    if (modification) modifications.push(modification);
  }
  return modifications;
};

export const getPlayerModifications = ({
  baseExercises,
  playerExerciseSets,
  language,
}: GetPlayerModificationsProps): PlayerModification[] => {
  const baseExercisesByName = groupExercisesByName(baseExercises, language);
  const playerExercisesByName = groupExercisesByName(playerExerciseSets, language);
  const deletedExercises = getDeletedExerciseModifications({
    baseExercisesByName,
    playerExercisesByName,
  });
  const setModifications = Array.from(playerExercisesByName.entries()).flatMap(
    ([exerciseNameKey, playerSets]) =>
      getSetModifications({
        exerciseName: playerSets[0].exercise,
        baseSets: baseExercisesByName.get(exerciseNameKey) || [],
        playerSets,
      }),
  );
  return [...deletedExercises, ...setModifications];
};

export const getAllModifications = ({
  baseExercises,
  playerExerciseSets,
  language,
}: GetAllModificationsProps) => {
  const baseExercisesByName = groupExercisesByName(baseExercises, language);
  const playerExercisesByName = groupExercisesByName(playerExerciseSets, language);
  return {
    modifications: getPlayerModifications({ baseExercises, playerExerciseSets, language }),
    deletedExercises: getDeletedExerciseModifications({
      baseExercisesByName,
      playerExercisesByName,
    }),
    newExercises: getNewExercises({ baseExercisesByName, playerExercisesByName }),
  };
};

