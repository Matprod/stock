export const CLUB_LANGUAGES = ['en', 'fr'] as const
export type ClubLanguage = typeof CLUB_LANGUAGES[number]

export const CLUB_LANGUAGE_OPTIONS: Array<{ label: string; value: 'en' | 'fr' }> = [
  { label: 'English', value: 'en' },
  { label: 'Français', value: 'fr' },
]
