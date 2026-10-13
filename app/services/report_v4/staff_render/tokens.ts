import { pickTextOnFill } from '#services/report_v4/staff_render/contrast'

export const STAFF_PAGE = {
  widthPx: 794,
  heightPx: 1123,
  marginXPx: 48,
} as const

export const STAFF_FONTS = {
  display: 'Barlow Condensed',
  body: 'Barlow',
} as const

export const STAFF_TYPE_SCALE_PX = {
  display: 28,
  title: 18,
  subtitle: 13,
  body: 12,
  caption: 10,
  data: 11,
  kpi: 32,
  footer: 9,
} as const

export const STAFF_COLORS = {
  ink: '#0F1B2D',
  inkSoft: '#43506A',
  muted: '#667085',
  line: '#D9DEE6',
  lineSoft: '#EEF1F4',
  blockBg: '#F3F5F8',
  accent: '#9A3412',
  paper: '#FFFFFF',
  series: {
    risk: '#C2410C',
    performance: '#1F5FB5',
  },
} as const

export type StaffRiskRampBand = {
  min: number
  max: number | null
  fill: string
}

export type StaffPerformanceRampBand = {
  min: number | null
  max: number | null
  fill: string
}

export const STAFF_RISK_RAMP: readonly StaffRiskRampBand[] = [
  { min: 0, max: 9, fill: '#EEF1F4' },
  { min: 10, max: 24, fill: '#FCD9B6' },
  { min: 25, max: 49, fill: '#F2994A' },
  { min: 50, max: 74, fill: '#C2410C' },
  { min: 75, max: null, fill: '#7C2D12' },
] as const

export const STAFF_PERFORMANCE_RAMP: readonly StaffPerformanceRampBand[] = [
  { min: null, max: 34, fill: '#E8EEF8' },
  { min: 35, max: 44, fill: '#BFD3F0' },
  { min: 45, max: 54, fill: '#8DB0E3' },
  { min: 55, max: 64, fill: '#3F77C4' },
  { min: 65, max: null, fill: '#1F4E96' },
] as const

export type StaffTextOnSurfacePair = {
  id: string
  text: string
  background: string
}

export const staffRiskFill = (value: number): string => {
  for (const band of STAFF_RISK_RAMP) {
    if (value < band.min) continue
    if (band.max === null || value <= band.max) return band.fill
  }
  return STAFF_RISK_RAMP[STAFF_RISK_RAMP.length - 1]!.fill
}

export const staffPerformanceFill = (value: number): string => {
  for (const band of STAFF_PERFORMANCE_RAMP) {
    if (band.min !== null && value < band.min) continue
    if (band.max !== null && value > band.max) continue
    return band.fill
  }
  return STAFF_PERFORMANCE_RAMP[STAFF_PERFORMANCE_RAMP.length - 1]!.fill
}

export const staffTextOnFill = (fill: string): string =>
  pickTextOnFill(fill, [STAFF_COLORS.ink, STAFF_COLORS.paper])

export const staffTextOnSurfacePairs = (): StaffTextOnSurfacePair[] => {
  const { ink, inkSoft, muted, blockBg, paper, accent, lineSoft } = STAFF_COLORS
  const pairs: StaffTextOnSurfacePair[] = [
    { id: 'ink_on_paper', text: ink, background: paper },
    { id: 'inkSoft_on_paper', text: inkSoft, background: paper },
    { id: 'muted_on_paper', text: muted, background: paper },
    { id: 'ink_on_blockBg', text: ink, background: blockBg },
    { id: 'inkSoft_on_blockBg', text: inkSoft, background: blockBg },
    { id: 'muted_on_blockBg', text: muted, background: blockBg },
    { id: 'accent_on_paper', text: accent, background: paper },
    { id: 'ink_on_lineSoft', text: ink, background: lineSoft },
  ]
  for (const [index, band] of STAFF_RISK_RAMP.entries()) {
    pairs.push({
      id: `risk_ramp_${index}_text`,
      text: staffTextOnFill(band.fill),
      background: band.fill,
    })
  }
  for (const [index, band] of STAFF_PERFORMANCE_RAMP.entries()) {
    pairs.push({
      id: `performance_ramp_${index}_text`,
      text: staffTextOnFill(band.fill),
      background: band.fill,
    })
  }
  return pairs
}
