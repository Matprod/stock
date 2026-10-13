// Ported from backend-v2/chart-kit/chart-lib.mjs (contrastRatio / rel). Do not import the kit zip.

const relativeLuminance = (hex: string): number => {
  const normalized = hex.trim().replace(/^#/, '')
  const full =
    normalized.length === 3
      ? [...normalized].map((c) => c + c).join('')
      : normalized
  const channels = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
  const linear = channels.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!
}

export const contrastRatio = (a: string, b: string): number => {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

export const STAFF_MIN_TEXT_CONTRAST = 4.5

export const pickTextOnFill = (
  fill: string,
  candidates: readonly [string, string] = ['#0F1B2D', '#FFFFFF']
): string => {
  let best = candidates[0]
  let bestRatio = contrastRatio(best, fill)
  for (const candidate of candidates) {
    const ratio = contrastRatio(candidate, fill)
    if (ratio > bestRatio) {
      best = candidate
      bestRatio = ratio
    }
  }
  return best
}
