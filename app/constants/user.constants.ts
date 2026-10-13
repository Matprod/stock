export const USER_ROLE = {
  SUPER_ADMIN: 'super_admin',
  CLUB_ADMIN: 'club_admin',
  CLUB_STAFF: 'club_staff',
} as const

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE]

export const USER_DEFAULT_PAGE = {
  CALENDAR: 'CALENDAR',
  TEAM_LIST: 'TEAM_LIST',
  DASHBOARD: 'DASHBOARD',
  NOTES: 'NOTES',
  WORKOUT_SESSIONS: 'WORKOUT_SESSIONS',
  HEALTH: 'HEALTH',
  STYLE_GUIDE: 'STYLE_GUIDE',
  PRIVACY: 'PRIVACY',
} as const

export type UserDefaultPage = (typeof USER_DEFAULT_PAGE)[keyof typeof USER_DEFAULT_PAGE]
