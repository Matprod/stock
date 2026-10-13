export const CLUB_PROVIDER_TYPES = {
  MY_COACH: 'my_coach',
  CATAPULT: 'catapult',
  STATSPORTS: 'statsports',
  SKILLCORNER: 'skillcorner',
  DFL: 'dfl',
  TEAMBUILDR: 'teambuildr',
  VALD: 'vald',
} as const

export type ClubProviderType = (typeof CLUB_PROVIDER_TYPES)[keyof typeof CLUB_PROVIDER_TYPES]
