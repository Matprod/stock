import {
  PREMIUM_DOMAIN,
  PREMIUM_DOMAINS,
  type PremiumDomain,
} from '#constants/premium_report_domains'
import { foldAscii, foldKey as foldKeyUtil } from '#utils/html_text'

export const REPORT_V4_DOMAIN_ALIASES: Array<{ domain: PremiumDomain; aliases: string[] }> = [
  {
    domain: PREMIUM_DOMAIN.SCORES,
    aliases: [
      'scores?',
      'score',
      'performance_score',
      'injury_risk_score',
      'performance scores?',
      'injury risk',
      'scores? de performance',
      'risque de blessure',
    ],
  },
  {
    domain: PREMIUM_DOMAIN.BIOMARKERS,
    aliases: [
      'biomarkers?',
      'biomarqueurs?',
      'creatine kinase',
      'creatine_kinase',
      'ferritin',
      'ferritine',
      'cortisol',
    ],
  },
  {
    domain: PREMIUM_DOMAIN.WELLNESS,
    aliases: [
      'wellness',
      'readiness',
      'soreness',
      'subjective',
      'mood',
      'energy',
      'stress',
      'bien etre',
      'forme',
      'fatigue',
      'courbatures?',
      'humeur',
      'energie',
      'ressenti',
    ],
  },
  {
    domain: PREMIUM_DOMAIN.SLEEP,
    aliases: ['sleep', 'hrv', 'sommeil', 'qualite de sommeil'],
  },
  {
    domain: PREMIUM_DOMAIN.GPS,
    aliases: [
      'gps',
      'hsr',
      'sprint',
      'distance',
      'accel',
      'decel',
      'cod',
      'accelerations?',
      'decelerations?',
      'freinages?',
    ],
  },
  {
    domain: PREMIUM_DOMAIN.LOAD,
    aliases: ['load', 'acwr', 'srpe', 'rpe', 'monotony', 'strain', 'charge', 'monotonie'],
  },
  {
    domain: PREMIUM_DOMAIN.MATCH,
    aliases: [
      'match',
      'matches',
      'matchs?',
      'skillcorner',
      'competition',
      'competitions?',
      'game',
      'minutes_played',
      'minutes jouees?',
      'tackles',
      'box_score',
    ],
  },
  {
    domain: PREMIUM_DOMAIN.VALD,
    aliases: [
      'test_type',
      'cmj',
      'countermovement',
      'drop[- ]?jump',
      'single[- ]?leg',
      'jump(?:s|ing)?',
      'sauts?',
      'rsi',
      'rfd',
      'asymmetr(?:y|ies)',
      'asymetries?',
      'force[- ]?testing',
      'force[- ]?tests?',
      'strength[- ]?tests?',
      'physical[- ]?tests?',
      'physical[- ]?trials?',
      'vald[- ]?tests?',
      'tests? de force',
      'essais? de force',
    ],
  },
  {
    domain: PREMIUM_DOMAIN.BODY,
    aliases: [
      'body',
      'body.?comp',
      'body composition',
      'composition corporelle',
      'weight',
      'poids',
      'fat\\s*%?',
      'masse grasse',
      'anthropo',
      'anthropometrie',
    ],
  },
  {
    domain: PREMIUM_DOMAIN.INJURY,
    aliases: [
      'injuries',
      'injury',
      'injury.?log',
      'injury.?history',
      'injured',
      'availability',
      'rehab',
      'return.?to.?play',
      'rtp',
      'time.?loss',
      'blessures?',
      'blesse(?:e|es|s)?',
      'disponibilite',
      'reprise',
      'retour.?au.?jeu',
      'reathletisation',
    ],
  },
]

export const foldDomainAliasHay = (value: string): string =>
  foldAscii(foldKeyUtil(value)).replace(/-/g, ' ')

const domainAliasWordRe = (alias: string): RegExp =>
  new RegExp(String.raw`(?:^|[^a-z0-9_])(?:${alias})(?:[^a-z0-9_]|$)`, 'i')

export const domainAliasMatches = (text: string, domain: PremiumDomain): boolean => {
  const hay = foldDomainAliasHay(text)
  const row = REPORT_V4_DOMAIN_ALIASES.find((entry) => entry.domain === domain)
  if (!row) return foldDomainAliasHay(domain) === hay || domainAliasWordRe(domain).test(hay)
  return row.aliases.some((alias) => {
    if (alias === 'ck' || alias === 'lab') return false
    try {
      return domainAliasWordRe(alias).test(hay)
    } catch {
      return hay.includes(foldDomainAliasHay(alias))
    }
  })
}

export const domainsMatchingAliases = (text: string): PremiumDomain[] =>
  PREMIUM_DOMAINS.filter((domain) => domainAliasMatches(text, domain))
