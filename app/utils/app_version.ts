import type { AppPlatform } from '#contracts/mobile/app_version'

export const parseAppPlatform = (value: string | null): AppPlatform | null => {
  if (!value) return null

  const normalized = value.trim().toLowerCase()
  if (normalized === 'ios' || normalized === 'android') {
    return normalized
  }

  return null
}

export const isVersionLower = (appVersion: string, minimalVersion: string): boolean => {
  const appParts = parseVersion(appVersion)
  const minimalParts = parseVersion(minimalVersion)
  const maxLength = Math.max(appParts.length, minimalParts.length)

  for (let index = 0; index < maxLength; index++) {
    const appPart = appParts[index] ?? 0
    const minimalPart = minimalParts[index] ?? 0

    if (appPart < minimalPart) {
      return true
    }

    if (appPart > minimalPart) {
      return false
    }
  }

  return false
}

const parseVersion = (version: string): number[] => {
  return version
    .trim()
    .replace(/^v/i, '')
    .split(/[.-]/)
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isNaN(part) ? 0 : part))
}
