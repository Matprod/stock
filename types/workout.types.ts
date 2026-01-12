import type { APISportActivity } from "./sportactivity.types";

export const EXERCISE_TYPE = {
  BODYWEIGHT_REPS: "BODYWEIGHT_REPS",
  BODYWEIGHT_TIME: "BODYWEIGHT_TIME",
  WEIGHTED_REPS: "WEIGHTED_REPS",
  WEIGHTED_TIME: "WEIGHTED_TIME",
} as const;

export type ExerciseType = (typeof EXERCISE_TYPE)[keyof typeof EXERCISE_TYPE];

export type ChangeValue<T> = { original: T; modified: T };

export interface WorkoutExercice {
  id: number;
  nameFr: string | null;
  nameEn: string | null;
  activityId: number | null;
  type: ExerciseType | null;
  activity: Activity;
}

export type ExerciseName = Pick<WorkoutExercice, "nameFr" | "nameEn">;

export interface Activity {
  id: number;
  nameFr: string;
  nameEn: string;
}

export interface Workout {
  id: number;
  name: string;
  exercises: WorkoutExercice[];
  duration: number | null;
}

export interface StartSessionPayload {
  workoutId: number;
  startTime: string;
  exercises: Array<{
    id: number;
    sets: Array<{
      order: number;
      reps?: number;
      weight?: number;
      duration?: string;
    }>;
  }>;
  players: Array<number>;
  duration: number | null;
}

export interface APIExerciseSet {
  id: number;
  reps?: number;
  weight?: number;
  time?: string;
  order: number | null;
  setOrder: number | null;
  exerciseId: number;
  exercise: WorkoutExercice;
}

export interface APIWorkoutHistory {
  id: number;
  title: string;
  duration: number | null;
  startTime: string;
  workoutSessionId: number;
  exercises: Array<APIExerciseSet>;
  sportActivities: Array<APISportActivity>;
}

export interface PlayerModification {
  exerciseName: ExerciseName;
  setIndex: number;
  changes: {
    reps?: ChangeValue<number | null>;
    weight?: ChangeValue<number | null>;
    time?: ChangeValue<string | null>;
  };
  isNewSet?: boolean;
  isDeletedSet?: boolean;
}

export interface NewExercise {
  exerciseName: ExerciseName;
}
