import { REPORT_DESIGN_PACK_IDS } from '#services/report_v4/report_v4_constants'

export { REPORT_DESIGN_PACK_IDS }
export type ReportDesignPackId = (typeof REPORT_DESIGN_PACK_IDS)[number]

export type ReportDesignPack = {
  id: ReportDesignPackId
  fonts: {
    body: string
    display: string
    googleHref: string
  }
  palette: string[]
  tokens: {
    bg: string
    primary: string
    lightPrimary: string
    ink: string
    inkSoft: string
    paper: string
    line: string
    muted: string
    cherry: string
    cherrySoft: string
    saffron: string
    saffronSoft: string
    coverGradient: string
    bandGradient: string
    commentBg: string
    commentBorder: string
    season: string
    clubMark: string
    kpi: [string, string, string, string]
  }
  /** Short hint injected into the content agent (never invent HTML). */
  promptHint: string
}

const mauna: ReportDesignPack = {
  id: 'mauna',
  fonts: {
    body: '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif',
    display: '"IBM Plex Sans Condensed", "IBM Plex Sans", sans-serif',
    googleHref:
      'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Sans+Condensed:wght@600;700&display=swap',
  },
  palette: [
    '#38BDF8',
    '#34D399',
    '#FBBF24',
    '#A78BFA',
    '#F87171',
    '#F472B6',
    '#2DD4BF',
    '#FB923C',
    '#7DD3FC',
    '#86EFAC',
  ],
  tokens: {
    bg: '#0b1f3a',
    primary: '#4f6ef7',
    lightPrimary: '#74c0fc',
    ink: '#0f172a',
    inkSoft: '#334155',
    paper: '#f8fafc',
    line: '#cbd5e1',
    muted: '#64748b',
    cherry: '#E07070',
    cherrySoft: '#f3d4d4',
    saffron: '#E8B84A',
    saffronSoft: '#f5e6c8',
    coverGradient: '#0b1f3a',
    bandGradient: '#0b1f3a',
    commentBg: '#f8fafc',
    commentBorder: '#c7d2fe',
    season: '#93c5fd',
    clubMark: '#94a3b8',
    kpi: ['#4f6ef7', '#38BDF8', '#34D399', '#FBBF24'],
  },
  promptHint:
    'Pack MAUNA A4 print: solid navy cover/bands (#0b1f3a / #1a1d2b), no CSS gradients. Series palette sky/emerald/amber. KPI = white bordered .kpi tiles (grid), never coloured bars. Dense executive flow; chart titles = metric (+ i/n), never athlete name ranges or Group N. No emojis.',
}

const clinical: ReportDesignPack = {
  id: 'clinical',
  fonts: {
    body: '"Source Sans 3", ui-sans-serif, system-ui, sans-serif',
    display: '"Source Sans 3", ui-sans-serif, system-ui, sans-serif',
    googleHref:
      'https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600;700&display=swap',
  },
  palette: [
    '#0D9488',
    '#0891B2',
    '#64748B',
    '#CA8A04',
    '#DC2626',
    '#7C3AED',
    '#059669',
    '#EA580C',
    '#0284C7',
    '#4B5563',
  ],
  tokens: {
    bg: '#0f766e',
    primary: '#0f766e',
    lightPrimary: '#5eead4',
    ink: '#134e4a',
    inkSoft: '#334155',
    paper: '#f0fdfa',
    line: '#99f6e4',
    muted: '#64748b',
    cherry: '#DC2626',
    cherrySoft: '#fecaca',
    saffron: '#CA8A04',
    saffronSoft: '#fde68a',
    coverGradient: '#134e4a',
    bandGradient: '#0f766e',
    commentBg: '#ffffff',
    commentBorder: '#99f6e4',
    season: '#5eead4',
    clubMark: '#99f6e4',
    kpi: ['#0D9488', '#0891B2', '#059669', '#CA8A04'],
  },
  promptHint:
    'Pack Clinical A4 print: solid teal bands (#0f766e / #134e4a), paper #f0fdfa, no gradients. KPI = white bordered .kpi tiles only when InsightIR has real figures. Dense but airy; human chart titles only — never Group N. No invented KPIs or filler sections.',
}

const editorial: ReportDesignPack = {
  id: 'editorial',
  fonts: {
    body: '"Libre Franklin", ui-sans-serif, system-ui, sans-serif',
    display: '"Libre Franklin", ui-sans-serif, system-ui, sans-serif',
    googleHref:
      'https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;500;600;700;800&display=swap',
  },
  palette: [
    '#111827',
    '#B91C1C',
    '#1D4ED8',
    '#047857',
    '#B45309',
    '#6D28D9',
    '#0E7490',
    '#BE123C',
    '#374151',
    '#9A3412',
  ],
  tokens: {
    bg: '#111827',
    primary: '#111827',
    lightPrimary: '#F87171',
    ink: '#111827',
    inkSoft: '#374151',
    paper: '#fafafa',
    line: '#e5e7eb',
    muted: '#6b7280',
    cherry: '#B91C1C',
    cherrySoft: '#fecaca',
    saffron: '#B45309',
    saffronSoft: '#fde68a',
    coverGradient: '#111827',
    bandGradient: '#111827',
    commentBg: '#ffffff',
    commentBorder: '#e5e7eb',
    season: '#FCA5A5',
    clubMark: '#9CA3AF',
    kpi: ['#374151', '#B91C1C', '#1D4ED8', '#047857'],
  },
  promptHint:
    'Pack Editorial A4 print: solid black bands (#111827), red/blue accents, high-contrast type. KPI = white bordered .kpi tiles when figures exist. Dense captions; human chart titles only — never Group N. No invented KPIs or half-empty pages.',
}

const PACKS: Record<ReportDesignPackId, ReportDesignPack> = {
  mauna,
  clinical,
  editorial,
}

export const resolveReportDesignPack = (id?: string | null): ReportDesignPack => {
  if (id && (REPORT_DESIGN_PACK_IDS as readonly string[]).includes(id)) {
    return PACKS[id as ReportDesignPackId]
  }
  return PACKS.mauna
}

const fold = (value: string): string => value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')

export const resolveDesignPackFromPrompt = (
  prompt: string,
  fallbackId?: string | null
): { pack: ReportDesignPack; explicit: boolean } => {
  const text = fold(prompt)
  const tagged =
    text.match(/\bda\s*[:=]\s*(mauna|clinical|editorial)\b/) ||
    text.match(/\[\s*theme\s*[:=]\s*(mauna|clinical|editorial)\s*\]/) ||
    text.match(/\btheme\s*[:=]\s*(mauna|clinical|editorial)\b/)
  if (tagged?.[1] && (REPORT_DESIGN_PACK_IDS as readonly string[]).includes(tagged[1])) {
    return { pack: PACKS[tagged[1] as ReportDesignPackId], explicit: true }
  }
  return { pack: resolveReportDesignPack(fallbackId), explicit: false }
}
