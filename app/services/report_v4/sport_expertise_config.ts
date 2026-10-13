export type AcwrZoneKey = 'under' | 'ok' | 'watch' | 'risk'

export type AcwrZoneConfig = {
  thresholds: [number, number, number]
  labelsFr: [string, string, string, string]
  labelsEn: [string, string, string, string]
  noteEn: string
}

export type EvidenceLevel = 'association' | 'local_contribution' | 'tested_cause'

export type EvidenceVocabulary = {
  level: EvidenceLevel
  allowFr: string[]
  allowEn: string[]
  forbidFr: string[]
  forbidEn: string[]
}

export type PositionThresholdOverrides = {
  positionGroup: 'goalkeeper' | 'defender' | 'midfielder' | 'forward' | 'default'
  acwr?: Partial<AcwrZoneConfig>
}

export type ClubExpertiseConfig = {
  clubId?: string
  seasonLabel?: string
  acwr: AcwrZoneConfig
  positionOverrides: PositionThresholdOverrides[]
  evidence: EvidenceVocabulary[]
}

export const DEFAULT_ACWR_ZONES: AcwrZoneConfig = {
  thresholds: [0.8, 1.3, 1.5],
  labelsFr: ['sous-charge', 'zone cible', 'vigilance', 'risque élevé'],
  labelsEn: ['underload', 'target zone', 'watch', 'elevated risk'],
  noteEn:
    'Literature-default ACWR bands; override per club/position/season — never hard-code in render.',
}

export const DEFAULT_EVIDENCE_VOCABULARY: EvidenceVocabulary[] = [
  {
    level: 'association',
    allowFr: ['associé à', 'corrélé avec', 'coïncide avec'],
    allowEn: ['associated with', 'correlated with', 'coincides with'],
    forbidFr: ['cause', 'provoque', 'explique'],
    forbidEn: ['causes', 'drives', 'explains'],
  },
  {
    level: 'local_contribution',
    allowFr: ['contribue localement', 'poids local', 'influence estimée'],
    allowEn: ['local contribution', 'estimated weight', 'local influence'],
    forbidFr: ['prouve que', 'démontre causalement'],
    forbidEn: ['proves that', 'causally demonstrates'],
  },
  {
    level: 'tested_cause',
    allowFr: ['effet testé', 'intervention contrôlée'],
    allowEn: ['tested effect', 'controlled intervention'],
    forbidFr: [],
    forbidEn: [],
  },
]

export const DEFAULT_CLUB_EXPERTISE: ClubExpertiseConfig = {
  acwr: DEFAULT_ACWR_ZONES,
  positionOverrides: [
    { positionGroup: 'default' },
    { positionGroup: 'goalkeeper' },
    { positionGroup: 'defender' },
    { positionGroup: 'midfielder' },
    { positionGroup: 'forward' },
  ],
  evidence: DEFAULT_EVIDENCE_VOCABULARY,
}

export const resolveClubExpertiseConfig = (args?: {
  clubId?: string
  seasonLabel?: string
  overrides?: Partial<ClubExpertiseConfig>
}): ClubExpertiseConfig => ({
  ...DEFAULT_CLUB_EXPERTISE,
  ...(args?.overrides ?? {}),
  clubId: args?.clubId ?? args?.overrides?.clubId,
  seasonLabel: args?.seasonLabel ?? args?.overrides?.seasonLabel,
  acwr: {
    ...DEFAULT_ACWR_ZONES,
    ...(args?.overrides?.acwr ?? {}),
  },
  positionOverrides: args?.overrides?.positionOverrides?.length
    ? args.overrides.positionOverrides
    : DEFAULT_CLUB_EXPERTISE.positionOverrides,
  evidence: args?.overrides?.evidence?.length
    ? args.overrides.evidence
    : DEFAULT_CLUB_EXPERTISE.evidence,
})

export const acwrZonesForPosition = (
  config: ClubExpertiseConfig,
  positionGroup: PositionThresholdOverrides['positionGroup'] = 'default'
): AcwrZoneConfig => {
  const override = config.positionOverrides.find((row) => row.positionGroup === positionGroup)
  if (!override?.acwr) return config.acwr
  return {
    ...config.acwr,
    ...override.acwr,
    thresholds: override.acwr.thresholds ?? config.acwr.thresholds,
    labelsFr: override.acwr.labelsFr ?? config.acwr.labelsFr,
    labelsEn: override.acwr.labelsEn ?? config.acwr.labelsEn,
  }
}

export const zoneOfAcwr = (
  value: number,
  zones: AcwrZoneConfig = DEFAULT_ACWR_ZONES,
  language: 'fr' | 'en' = 'en'
): { key: AcwrZoneKey; label: string } => {
  const [a, b, c] = zones.thresholds
  const labels = language === 'fr' ? zones.labelsFr : zones.labelsEn
  if (value < a) return { key: 'under', label: labels[0] }
  if (value <= b) return { key: 'ok', label: labels[1] }
  if (value <= c) return { key: 'watch', label: labels[2] }
  return { key: 'risk', label: labels[3] }
}

export const STATUS_FILL: Record<AcwrZoneKey, string> = {
  under: '#64748b',
  ok: '#0ca30c',
  watch: '#fab219',
  risk: '#d03b3b',
}
