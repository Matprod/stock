export const EXERCISE_TYPE = {
  BODYWEIGHT_REPS: 'bodyweight_reps',
  BODYWEIGHT_TIME: 'bodyweight_time',
  WEIGHTED_REPS: 'weighted_reps',
  WEIGHTED_TIME: 'weighted_time',
} as const

export type ExerciseType = (typeof EXERCISE_TYPE)[keyof typeof EXERCISE_TYPE]

export const EXERCISE_DIFFICULTY = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
  VERY_HARD: 'very_hard',
} as const

export type ExerciseDifficulty = (typeof EXERCISE_DIFFICULTY)[keyof typeof EXERCISE_DIFFICULTY]

export const EXERCISE_DIFFICULTY_TO_INTENSITY_COEFFICIENT: Record<ExerciseDifficulty, number> = {
  [EXERCISE_DIFFICULTY.EASY]: 0.5,
  [EXERCISE_DIFFICULTY.MEDIUM]: 0.6,
  [EXERCISE_DIFFICULTY.HARD]: 0.7,
  [EXERCISE_DIFFICULTY.VERY_HARD]: 0.9,
}

export const WORKOUT_HISTORY_CURSOR_PAGE_SIZE = 50
