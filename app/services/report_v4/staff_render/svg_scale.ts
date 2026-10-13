export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

export const linearScale = (
  domain: readonly [number, number],
  range: readonly [number, number]
): ((value: number) => number) => {
  const [d0, d1] = domain
  const [r0, r1] = range
  const span = d1 - d0
  if (span === 0) return () => (r0 + r1) / 2
  return (value: number) => r0 + ((value - d0) / span) * (r1 - r0)
}

export const mean = (values: number[]): number | null => {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

export type StaffTrend = 'up' | 'down' | 'flat'

export const seriesTrend = (values: number[], flatEpsilon = 1): StaffTrend => {
  if (values.length < 2) return 'flat'
  const first = values[0]!
  const last = values[values.length - 1]!
  const delta = last - first
  if (Math.abs(delta) < flatEpsilon) return 'flat'
  return delta > 0 ? 'up' : 'down'
}
