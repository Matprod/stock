export const GENDER = {
  MALE: 'male',
  FEMALE: 'female',
} as const

export type Gender = (typeof GENDER)[keyof typeof GENDER]
