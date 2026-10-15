import type { AppLanguage } from '#utils/localize'
import { parseAppLanguage } from '#utils/localize'

const fold = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/['’`-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const FR_PHRASES = [
  'semaine derniere',
  'cette semaine',
  'derniers jours',
  'dernieres semaines',
  'aujourd hui',
  'bien etre',
  'joueurs a suivre',
  'fiche joueur',
  'fiches joueurs',
  'rapport staff',
  'bilan staff',
  'donnees',
  'entrainement',
  'courbature',
  'blessures',
  'disponibilite',
] as const

const EN_PHRASES = [
  'last week',
  'this week',
  'last 7 days',
  'last seven days',
  'individual sheets',
  'athlete sheets',
  'weekly report',
  'staff report',
  'players to watch',
  'data reliability',
  'training load',
] as const

const FR_WORDS = [
  'bilan',
  'semaine',
  'derniere',
  'dernieres',
  'derniers',
  'joueurs',
  'joueur',
  'equipe',
  'fiche',
  'fiches',
  'sommeil',
  'blessure',
  'humeur',
  'fatigue',
  'charge',
  'rapport',
  'aujourd',
  'donnees',
  'entrainement',
  'courbatures',
  'disponibilite',
  'couverture',
  'insuffisante',
] as const

const EN_WORDS = [
  'weekly',
  'report',
  'players',
  'player',
  'squad',
  'overview',
  'wellness',
  'sleep',
  'injury',
  'injuries',
  'sheets',
  'sheet',
  'training',
  'coverage',
  'shortfall',
  'missing',
  'load',
] as const

const countPhraseHits = (text: string, phrases: readonly string[]): number => {
  let score = 0
  for (const phrase of phrases) {
    if (text.includes(phrase)) score += 2
  }
  return score
}

const countWordHits = (text: string, words: readonly string[]): number => {
  let score = 0
  for (const word of words) {
    const re = new RegExp(String.raw`(?:^|[^a-z0-9_])${word}(?:[^a-z0-9_]|$)`, 'g')
    const hits = text.match(re)
    if (hits) score += hits.length
  }
  return score
}

export const detectReportLanguageLexical = (prompt: string): AppLanguage | null => {
  const text = fold(prompt)
  if (!text.trim()) return null
  const accentBonus = (prompt.match(/[àâäéèêëïîôùûüçœæ]/gi) ?? []).length
  const fr =
    countPhraseHits(text, FR_PHRASES) + countWordHits(text, FR_WORDS) + Math.min(3, accentBonus)
  const en = countPhraseHits(text, EN_PHRASES) + countWordHits(text, EN_WORDS)
  if (fr === 0 && en === 0) return null
  if (fr >= en + 1) return 'fr'
  if (en >= fr + 1) return 'en'
  return null
}

export const detectReportLanguage = (prompt: string): AppLanguage =>
  detectReportLanguageLexical(prompt) ?? 'en'

export const resolveReportLanguage = (
  prompt: string,
  explicit?: string | null
): AppLanguage => {
  const parsed = parseAppLanguage(explicit)
  if (parsed) return parsed
  return detectReportLanguage(prompt)
}

export const defaultStaffReportTitle = (language: AppLanguage): string =>
  language === 'fr' ? 'Rapport staff' : 'Staff report'
