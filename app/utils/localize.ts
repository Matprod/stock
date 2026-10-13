export type AppLanguage = 'en' | 'fr'

export const APP_LANGUAGES = {
  EN: 'en',
  FR: 'fr',
} as const

export function parseAppLanguage(value: string | null | undefined): AppLanguage | null {
  if (!value) return null
  const normalized = value.toLowerCase()
  if (normalized === 'en' || normalized === 'fr') return normalized
  return null
}

export function getName(entity: { name?: string | null }, fallback = ''): string {
  return entity?.name ?? fallback
}
