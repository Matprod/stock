import { REPORT_DESIGN_PACK_IDS } from '#services/report_v4/report_v4_constants'

export { REPORT_DESIGN_PACK_IDS }
export type ReportDesignPackId = (typeof REPORT_DESIGN_PACK_IDS)[number]

export type ReportDesignPack = {
  id: ReportDesignPackId
  fonts: {
    body: string
    display: string
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
  },
  palette: [
    '#2a78d6',
    '#eb6834',
    '#0f8f62',
    '#b87a00',
    '#d55181',
    '#008300',
    '#6250d6',
    '#e34948',
  ],
  tokens: {
    bg: '#152033',
    primary: '#2a78d6',
    lightPrimary: '#5b9cf0',
    ink: '#1a2332',
    inkSoft: '#3d4f66',
    paper: '#f7f8fb',
    line: '#e2e6ee',
    muted: '#6b7a90',
    cherry: '#d03b3b',
    cherrySoft: '#faebeb',
    saffron: '#fab219',
    saffronSoft: '#fff7e8',
    coverGradient: '#152033',
    bandGradient: '#1c2a40',
    commentBg: '#f7f8fb',
    commentBorder: '#d8dee9',
    season: '#9eb6d4',
    clubMark: '#8b9bb0',
    kpi: ['#2a78d6', '#eb6834', '#0f8f62', '#b87a00'],
  },
  promptHint:
    'Pack MAUNA A4 print — Claude Artifact editorial: soft paper, quiet ink, slim band headers (not navy bricks), airy KPI/cards, fine borders. No CSS gradients / purple glow. Series palette contrast-validated (≥3:1 on paper). Status red/amber/green reserved. Structure cover→toc→executive→domains→outliers→athlete sheets→reliability. Chart titles = metric (+ i/n), never athlete name ranges or Group N. No emojis.',
}

const clinical: ReportDesignPack = {
  id: 'clinical',
  fonts: {
    body: '"Source Sans 3", ui-sans-serif, system-ui, sans-serif',
    display: '"Source Sans 3", ui-sans-serif, system-ui, sans-serif',
  },
  palette: [
    '#0f8f62',
    '#2a78d6',
    '#eb6834',
    '#6250d6',
    '#d55181',
    '#008300',
    '#b87a00',
    '#e34948',
  ],
  tokens: {
    bg: '#0f766e',
    primary: '#0f8f62',
    lightPrimary: '#5eead4',
    ink: '#134e4a',
    inkSoft: '#334155',
    paper: '#f0fdfa',
    line: '#99f6e4',
    muted: '#64748b',
    cherry: '#d03b3b',
    cherrySoft: '#faebeb',
    saffron: '#fab219',
    saffronSoft: '#fff7e8',
    coverGradient: '#134e4a',
    bandGradient: '#0f766e',
    commentBg: '#ffffff',
    commentBorder: '#99f6e4',
    season: '#5eead4',
    clubMark: '#99f6e4',
    kpi: ['#0f8f62', '#2a78d6', '#eb6834', '#6250d6'],
  },
  promptHint:
    'Pack Clinical A4 print: solid teal bands (#0f766e / #134e4a), paper #f0fdfa, no gradients. KPI = white bordered .kpi tiles only when InsightIR has real figures. Dense but airy; human chart titles only — never Group N. No invented KPIs or filler sections.',
}

const editorial: ReportDesignPack = {
  id: 'editorial',
  fonts: {
    body: '"Libre Franklin", ui-sans-serif, system-ui, sans-serif',
    display: '"Libre Franklin", ui-sans-serif, system-ui, sans-serif',
  },
  palette: [
    '#6250d6',
    '#eb6834',
    '#0f8f62',
    '#2a78d6',
    '#d55181',
    '#008300',
    '#b87a00',
    '#e34948',
  ],
  tokens: {
    bg: '#111827',
    primary: '#6250d6',
    lightPrimary: '#F87171',
    ink: '#111827',
    inkSoft: '#374151',
    paper: '#fafafa',
    line: '#e5e7eb',
    muted: '#6b7280',
    cherry: '#d03b3b',
    cherrySoft: '#f7e5e1',
    saffron: '#fab219',
    saffronSoft: '#fbf1dd',
    coverGradient: '#111827',
    bandGradient: '#111827',
    commentBg: '#ffffff',
    commentBorder: '#e5e7eb',
    season: '#FCA5A5',
    clubMark: '#9CA3AF',
    kpi: ['#6250d6', '#eb6834', '#0f8f62', '#2a78d6'],
  },
  promptHint:
    'Pack Editorial A4 print: solid black bands (#111827), contrast-validated series palette. Status red/amber/green reserved. KPI = white bordered .kpi tiles when figures exist. Dense captions; human chart titles only — never Group N. No invented KPIs or half-empty pages.',
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
