import type { ReportFormulaId } from '#constants/report_builder.constants'

export const PREMIUM_DOMAIN = {
  LOAD: 'load',
  GPS: 'gps',
  MATCH: 'match',
  WELLNESS: 'wellness',
  SLEEP: 'sleep',
  VALD: 'vald',
  BIOMARKERS: 'biomarkers',
  BODY: 'body',
  SCORES: 'scores',
  INJURY: 'injury',
} as const

export type PremiumDomain = (typeof PREMIUM_DOMAIN)[keyof typeof PREMIUM_DOMAIN]

export const PREMIUM_DOMAINS = Object.values(PREMIUM_DOMAIN) as PremiumDomain[]

export type PremiumDomainMacro = {
  name: string
  templateId:
    | 'daily_srpe'
    | 'gps_distance'
    | 'gps_intensity'
    | 'gps_intensity_daily'
    | 'match_stats'
    | 'match_stats_daily'
    | 'biomarkers'
    | 'biomarkers_daily'
    | 'vald_tests'
    | 'body_metrics'
    | 'daily_scores'
    | 'injuries'
  description: string
}

export type PremiumDomainConfig = {
  jev: { question: string; trueLabel: string; falseLabel: string }
  schemaTitles: string[]
  formulaIds: ReportFormulaId[]
  macros: PremiumDomainMacro[]
  loadSummary?: boolean
  correlation?: boolean
}

const LOAD_FORMULAS: ReportFormulaId[] = [
  'mean',
  'sum',
  'ewma',
  'ma',
  'median_ma',
  'cumulative',
  'monotony',
  'strain',
  'acwr_ewma',
  'acwr_ma',
]

const STATS_FORMULAS: ReportFormulaId[] = ['mean', 'sum', 'max', 'median', 'median_ma', 'ma']

const WELLNESS_FORMULAS: ReportFormulaId[] = [
  'zscore',
  'mean',
  'median',
  'sd',
  'cv',
  'p25',
  'p75',
  'p90',
  'p95',
  'delta_pct',
]

const CAPACITY_FORMULAS: ReportFormulaId[] = [
  'delta_pct',
  'pct_baseline',
  'zscore',
  'mean',
  'median',
  'max',
  'min',
]

const INJURY_FORMULAS: ReportFormulaId[] = ['mean', 'sum']

export const PREMIUM_DOMAIN_CATALOG: Record<PremiumDomain, PremiumDomainConfig> = {
  [PREMIUM_DOMAIN.LOAD]: {
    jev: {
      question:
        'Does `prompt` ask about training load, perceived effort, sRPE, monotony, strain, ACWR, EWMA load trends, or Foster?',
      trueLabel: 'Load / Foster / ACWR',
      falseLabel: 'No load analysis requested',
    },
    schemaTitles: [
      'Athlete Identity',
      'Daily Scores',
      'Health & Wellness',
      'Sport Activities & Training',
    ],
    formulaIds: LOAD_FORMULAS,
    macros: [
      {
        name: 'fetch_srpe_daily',
        templateId: 'daily_srpe',
        description: 'Daily sRPE per athlete',
      },
    ],
    loadSummary: true,
    correlation: true,
  },
  [PREMIUM_DOMAIN.GPS]: {
    jev: {
      question:
        'Does `prompt` ask about GPS/training session metrics (distance, accelerations, decelerations, HSR, player load, intensity) or team training physical averages over days? Answer false for jump/CMJ/strength tests-trials and match-only stats.',
      trueLabel: 'GPS / training intensity',
      falseLabel: 'No GPS training analysis requested',
    },
    schemaTitles: ['Athlete Identity', 'Sport Activities & Training', 'Activity Reference & Zones'],
    formulaIds: STATS_FORMULAS,
    macros: [
      {
        name: 'fetch_gps_distance',
        templateId: 'gps_distance',
        description: 'GPS distance + minutes per athlete',
      },
      {
        name: 'fetch_gps_intensity',
        templateId: 'gps_intensity',
        description: 'Period totals per athlete',
      },
      {
        name: 'fetch_gps_intensity_daily',
        templateId: 'gps_intensity_daily',
        description: 'Per day × athlete GPS intensity',
      },
    ],
    correlation: true,
  },
  [PREMIUM_DOMAIN.MATCH]: {
    jev: {
      question:
        'Does `prompt` ask about match/competition physical stats, minutes played, tackles, or game-day GPS — not routine training sessions?',
      trueLabel: 'Match / competition / minutes',
      falseLabel: 'No match analysis requested',
    },
    schemaTitles: ['Athlete Identity', 'Sport Activities & Training', 'Activity Reference & Zones'],
    formulaIds: STATS_FORMULAS,
    macros: [
      {
        name: 'fetch_match_stats_daily',
        templateId: 'match_stats_daily',
        description: 'Per day × athlete match/competition KPIs (sport_activity_metrics, games only)',
      },
      {
        name: 'fetch_match_stats',
        templateId: 'match_stats',
        description: 'Athlete-aggregated match/competition stats (prefer over free SQL)',
      },
    ],
    correlation: true,
  },
  [PREMIUM_DOMAIN.WELLNESS]: {
    jev: {
      question:
        'Does `prompt` ask about wellness ratings, soreness, mood, stress, energy, recovery feeling, or wellness z-scores — not sleep duration/quality specifically?',
      trueLabel: 'Wellness / soreness / mood / stress',
      falseLabel: 'No wellness analysis requested',
    },
    schemaTitles: ['Athlete Identity', 'Daily Scores', 'Health & Wellness'],
    formulaIds: WELLNESS_FORMULAS,
    macros: [],
    correlation: true,
  },
  [PREMIUM_DOMAIN.SLEEP]: {
    jev: {
      question:
        'Does `prompt` ask about sleep duration, sleep quality, nights, or recovery via sleep?',
      trueLabel: 'Sleep',
      falseLabel: 'No sleep analysis requested',
    },
    schemaTitles: ['Athlete Identity', 'Daily Scores', 'Sleep'],
    formulaIds: WELLNESS_FORMULAS,
    macros: [],
    correlation: true,
  },
  [PREMIUM_DOMAIN.VALD]: {
    jev: {
      question:
        'Does `prompt` ask about physical tests / trials (jump CMJ, drop jump, RSI, RFD, strength tests, asymmetries)? Answer false for GPS/training session metrics, match stats, blood biomarkers/labs, and false for a generic team average with no test/trial ask.',
      trueLabel: 'Physical tests / trials (jump, RSI, strength)',
      falseLabel: 'No physical tests/trials requested',
    },
    schemaTitles: ['Athlete Identity', 'Physical Tests & Trials', 'Strength & Force Testing'],
    formulaIds: CAPACITY_FORMULAS,
    macros: [
      {
        name: 'fetch_vald_tests',
        templateId: 'vald_tests',
        description: 'Physical test trials per athlete (test_type + trial metrics)',
      },
    ],
  },
  [PREMIUM_DOMAIN.BIOMARKERS]: {
    jev: {
      question:
        'Does `prompt` ask about blood biomarkers, CK, lab blood work, or lab markers of fatigue/recovery? Do NOT treat jump/CMJ/strength tests or trials as biomarkers.',
      trueLabel: 'Biomarkers / CK / lab markers',
      falseLabel: 'No biomarker analysis requested',
    },
    schemaTitles: ['Athlete Identity', 'Biomarkers'],
    formulaIds: CAPACITY_FORMULAS,
    macros: [
      {
        name: 'fetch_biomarkers',
        templateId: 'biomarkers',
        description: 'Biomarker averages per athlete × type',
      },
      {
        name: 'fetch_biomarkers_daily',
        templateId: 'biomarkers_daily',
        description: 'Daily biomarker values per athlete × type (trends / joins)',
      },
    ],
  },
  [PREMIUM_DOMAIN.BODY]: {
    jev: {
      question: 'Does `prompt` ask about body composition, weight, body fat %, or anthropometrics?',
      trueLabel: 'Body composition / weight / fat %',
      falseLabel: 'No body-metrics analysis requested',
    },
    schemaTitles: ['Athlete Identity', 'Body Metrics'],
    formulaIds: CAPACITY_FORMULAS,
    macros: [
      {
        name: 'fetch_body_metrics',
        templateId: 'body_metrics',
        description: 'Latest weight + fat % per athlete',
      },
    ],
  },
  [PREMIUM_DOMAIN.SCORES]: {
    jev: {
      question:
        'Does `prompt` ask about player performance scores, injury risk scores, daily scores, or Mauna ML scores (performance_score / injury_risk_score)? Answer false for clinical injury logs, rehab, or return-to-play lists (those are the injury domain).',
      trueLabel: 'Performance / injury risk scores',
      falseLabel: 'No daily scores analysis requested',
    },
    schemaTitles: ['Athlete Identity', 'Daily Scores'],
    formulaIds: STATS_FORMULAS,
    macros: [
      {
        name: 'fetch_daily_scores',
        templateId: 'daily_scores',
        description: 'Daily performance_score + injury_risk_score per athlete (0–100)',
      },
    ],
  },
  [PREMIUM_DOMAIN.INJURY]: {
    jev: {
      question:
        'Does `prompt` ask about clinical injuries, injury log/history, injured players, availability, rehab, or return-to-play? Answer false for ML injury_risk_score / performance scores alone.',
      trueLabel: 'Clinical injuries / availability / rehab',
      falseLabel: 'No clinical injury analysis requested',
    },
    schemaTitles: ['Athlete Identity', 'Injury & Pain'],
    formulaIds: INJURY_FORMULAS,
    macros: [
      {
        name: 'fetch_injuries',
        templateId: 'injuries',
        description:
          'Clinical injuries overlapping the window (joueur, dates, status, pathology, location, context)',
      },
    ],
  },
}

export const PREMIUM_CORRELATION_JEV = {
  question:
    'Does `prompt` ask to correlate, associate, link, or cross metrics (e.g. load×wellness, GPS×recovery, load↔sleep)?',
  trueLabel: 'Cross-metric correlation / association',
  falseLabel: 'No correlation analysis requested',
} as const

export const PREMIUM_SQL_FAILURE_CAP = 4

export const PREMIUM_DOMAIN_NOUL_THRESHOLD = 0.4

export const BASE_SCHEMA_TITLES = [
  'Athlete Identity',
  'Daily Scores',
  'Club & Positions Reference',
] as const

export const schemaTitlesForDomains = (domains: PremiumDomain[]): string[] => {
  const titles = new Set<string>(BASE_SCHEMA_TITLES)
  for (const domain of domains) {
    for (const title of PREMIUM_DOMAIN_CATALOG[domain].schemaTitles) titles.add(title)
  }
  return [...titles]
}

export const correlationDomains = (): PremiumDomain[] =>
  PREMIUM_DOMAINS.filter((domain) => PREMIUM_DOMAIN_CATALOG[domain].correlation)
