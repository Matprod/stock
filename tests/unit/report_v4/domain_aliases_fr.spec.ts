import { test } from '@japa/runner'
import { PREMIUM_DOMAIN, type PremiumDomain } from '#constants/premium_report_domains'
import {
  domainAliasMatches,
  domainsMatchingAliases,
} from '#services/report_v4/request/domain_aliases'

const sorted = (domains: PremiumDomain[]): PremiumDomain[] => [...domains].sort()

const assertExactDomains = (
  assert: { deepEqual: (a: unknown, b: unknown) => void },
  prompt: string,
  expected: PremiumDomain[]
) => {
  assert.deepEqual(sorted(domainsMatchingAliases(prompt)), sorted(expected))
}

test.group('report_v4 domain aliases · FR coach asks', () => {
  test('maps 15 real-looking coach asks (FR+EN mix)', ({ assert }) => {
    const cases: Array<{ prompt: string; domains: PremiumDomain[] }> = [
      {
        prompt: 'Qualité du sommeil de l’équipe sur 30 jours',
        domains: [PREMIUM_DOMAIN.SLEEP],
      },
      {
        prompt: 'Bilan blessures et disponibilité cette semaine',
        domains: [PREMIUM_DOMAIN.INJURY],
      },
      {
        prompt: 'Courbe de charge et ACWR sur 28 jours',
        domains: [PREMIUM_DOMAIN.LOAD],
      },
      {
        prompt: 'Bien-être et courbatures des 7 derniers jours',
        domains: [PREMIUM_DOMAIN.WELLNESS],
      },
      {
        prompt: 'Fatigue et forme du groupe après le microcycle',
        domains: [PREMIUM_DOMAIN.WELLNESS],
      },
      {
        prompt: 'Composition corporelle et poids des joueurs',
        domains: [PREMIUM_DOMAIN.BODY],
      },
      {
        prompt: 'Tests de force et sauts CMJ par poste',
        domains: [PREMIUM_DOMAIN.VALD],
      },
      {
        prompt: 'Stats matchs et minutes jouées du week-end',
        domains: [PREMIUM_DOMAIN.MATCH],
      },
      {
        prompt: 'Biomarqueurs CK et ferritine sur 90 jours',
        domains: [PREMIUM_DOMAIN.BIOMARKERS],
      },
      {
        prompt: 'Plan de reprise après blessure pour Ada',
        domains: [PREMIUM_DOMAIN.INJURY],
      },
      {
        prompt: 'Sleep quality and HRV for the squad last 14 days',
        domains: [PREMIUM_DOMAIN.SLEEP],
      },
      {
        prompt: 'Wellness mood energy and soreness trends',
        domains: [PREMIUM_DOMAIN.WELLNESS],
      },
      {
        prompt: 'Load monotony and strain for the midfielders',
        domains: [PREMIUM_DOMAIN.LOAD],
      },
      {
        prompt: 'Sommeil + wellness last week for Bea',
        domains: [PREMIUM_DOMAIN.SLEEP, PREMIUM_DOMAIN.WELLNESS],
      },
      {
        prompt: 'GPS HSR distance and accel this mesocycle',
        domains: [PREMIUM_DOMAIN.GPS],
      },
    ]

    assert.equal(cases.length, 15)
    for (const row of cases) {
      assertExactDomains(assert, row.prompt, row.domains)
    }
  })

  test('accent and hyphen folds match FR labels', ({ assert }) => {
    assert.isTrue(domainAliasMatches('Disponibilité du groupe', PREMIUM_DOMAIN.INJURY))
    assert.isTrue(domainAliasMatches('bien etre des athlètes', PREMIUM_DOMAIN.WELLNESS))
    assert.isTrue(domainAliasMatches('minutes jouées en championnat', PREMIUM_DOMAIN.MATCH))
    assert.isTrue(domainAliasMatches('qualité de sommeil', PREMIUM_DOMAIN.SLEEP))
  })

  test('broad tokens do not fire as substrings', ({ assert }) => {
    const controls: Array<{ prompt: string; forbidden: PremiumDomain[] }> = [
      { prompt: 'encode training notes for staff', forbidden: [PREMIUM_DOMAIN.GPS] },
      { prompt: 'anybody on the travel list', forbidden: [PREMIUM_DOMAIN.BODY] },
      { prompt: 'heavyweight comparison chart', forbidden: [PREMIUM_DOMAIN.BODY] },
      { prompt: 'gameplan for Tuesday session', forbidden: [PREMIUM_DOMAIN.MATCH] },
      { prompt: 'download the CSV export', forbidden: [PREMIUM_DOMAIN.LOAD] },
      { prompt: 'latest team results overview', forbidden: [PREMIUM_DOMAIN.VALD] },
    ]

    for (const row of controls) {
      const found = domainsMatchingAliases(row.prompt)
      for (const domain of row.forbidden) {
        assert.isFalse(
          found.includes(domain),
          `"${row.prompt}" must not match ${domain} (got ${found.join(',')})`
        )
      }
    }
  })

  test('bare broad whole words stay controlled', ({ assert }) => {
    assert.deepEqual(sorted(domainsMatchingAliases('cod only drill note')), [PREMIUM_DOMAIN.GPS])
    assert.deepEqual(sorted(domainsMatchingAliases('body metrics snapshot')), [PREMIUM_DOMAIN.BODY])
    assert.deepEqual(sorted(domainsMatchingAliases('weight check-in')), [PREMIUM_DOMAIN.BODY])
    assert.deepEqual(sorted(domainsMatchingAliases('game minutes report')), [PREMIUM_DOMAIN.MATCH])
    assert.deepEqual(sorted(domainsMatchingAliases('load monitoring pack')), [PREMIUM_DOMAIN.LOAD])
    assert.deepEqual(domainsMatchingAliases('tests without force context'), [])
  })
})
