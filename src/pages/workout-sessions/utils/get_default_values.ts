import { type APIWorkoutHistory, EXERCISE_TYPE, type Workout } from "../../../types/workout.types";
import type { WorkoutSessionData } from "../schemas/workout_schema";
import { getLocalizedName } from "../../../utils/language_config";
import type { SupportedLanguage } from "../../../utils/language_config";

export const getSetsDefaultValues = (
  type: WorkoutSessionData["exercises"][number]["type"],
): Omit<WorkoutSessionData["exercises"][number]["sets"][number], "order"> => {
  return {
    reps: type === EXERCISE_TYPE.BODYWEIGHT_REPS || type === EXERCISE_TYPE.WEIGHTED_REPS ? 10 : 0,
    weight: "",
    duration:
      type === EXERCISE_TYPE.BODYWEIGHT_TIME || type === EXERCISE_TYPE.WEIGHTED_TIME
        ? "00:01:00"
        : "",
  };
};

interface GetDefaultValuesProps {
  selectedSession: APIWorkoutHistory | null;
  selectedWorkout: Workout | null;
  currentLanguage: SupportedLanguage;
}

export const getDefaultValues = ({
  selectedSession,
  selectedWorkout,
  currentLanguage,
}: GetDefaultValuesProps): WorkoutSessionData => {
  if (selectedSession) {
    const sessionDate = new Date(selectedSession.startTime);
    const timeString = sessionDate.toTimeString().slice(0, 5);
    const singleAthlete = selectedSession.sportActivities.length === 1;

    const exercisesMap = new Map<
      number,
      {
        id: number;
        name: string;
        type: "BODYWEIGHT_REPS" | "BODYWEIGHT_TIME" | "WEIGHTED_REPS" | "WEIGHTED_TIME";
        sets: Array<{
          reps?: number | "";
          weight?: number | "";
          duration?: string;
        }>;
      }
    >();

    (singleAthlete ? selectedSession.sportActivities[0].exerciseSets : selectedSession.exercises)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.setOrder ?? 0) - (b.setOrder ?? 0))
      .forEach((exerciseSet) => {
        const exerciseId = exerciseSet.exerciseId;
        const exercise = exerciseSet.exercise;

        if (!exercisesMap.has(exerciseId)) {
          exercisesMap.set(exerciseId, {
            id: exerciseId,
            name: getLocalizedName(exercise, currentLanguage),
            type: exercise.type ?? EXERCISE_TYPE.WEIGHTED_REPS,
            sets: [],
          });
        }

        const exerciseData = exercisesMap.get(exerciseId)!;
        exerciseData.sets.push({
          reps: exerciseSet.reps || "",
          weight: exerciseSet.weight || "",
          duration: exerciseSet.time || "",
        });
      });

    return {
      exercises: Array.from(exercisesMap.values()).map((exercise) => ({
        ...exercise,
        sets: exercise.sets.map((set, index) => ({
          ...set,
          order: index + 1,
        })),
      })),
      players: selectedSession.sportActivities.map((activity) => activity.athleteDay.athleteId),
      date: sessionDate,
      time: timeString,
    };
  }

  if (!selectedWorkout) {
    return {
      exercises: [],
      players: [],
      date: new Date(),
      time: new Date().toTimeString().slice(0, 5),
    };
  }

  return {
    exercises: selectedWorkout.exercises.map((exercise) => ({
      id: exercise.id,
      name: getLocalizedName(exercise, currentLanguage),
      type: exercise.type ?? EXERCISE_TYPE.WEIGHTED_REPS,
      sets: [
        {
          ...getSetsDefaultValues(exercise.type ?? EXERCISE_TYPE.WEIGHTED_REPS),
          order: 1,
        },
      ],
    })),
    players: [],
    date: new Date(),
    time: new Date().toTimeString().slice(0, 5),
  };
};
