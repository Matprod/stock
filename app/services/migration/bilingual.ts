import type { AppLanguage } from '#utils/localize'

export type BilingualNames = {
  name: string
  translation?: { language: AppLanguage; value: string }
}

/**
 * Primary name: name_en, fallback name_fr.
 * If both exist and differ, returns a translation row for the secondary language.
 */
export function splitBilingualName(row: Record<string, unknown>): BilingualNames | null {
  const nameEn = String(row.name_en ?? '').trim()
  const nameFr = String(row.name_fr ?? '').trim()

  if (!nameEn && !nameFr) return null

  if (nameEn) {
    const translation =
      nameFr && nameFr !== nameEn ? { language: 'fr' as const, value: nameFr } : undefined
    return { name: nameEn, translation }
  }

  const translation =
    nameEn && nameEn !== nameFr ? { language: 'en' as const, value: nameEn } : undefined
  return { name: nameFr, translation }
}
