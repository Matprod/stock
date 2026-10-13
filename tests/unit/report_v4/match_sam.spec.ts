import { test } from '@japa/runner'
import { PREMIUM_DOMAIN } from '#constants/premium_report_domains'
import { selectMatchKpis, type ClubMetricCatalog } from '#services/premium_report/club_metric_catalog'
import {
  preferredMatchMetricNames,
  preferredMatchSourceFromPrompt,
  resolveCoachMetricsFromCatalog,
} from '#services/report_v4/coach_metric_resolve'
import { askDomainsFromHaikuJson } from '#services/report_v4/classify_ask_domains'

const catalogStub = (): ClubMetricCatalog => ({
  periodKpis: [],
  periodNames: [],
  matchKpis: [
    { name: 'minutes_played', alias: 'minutes_played', agg: 'SUM', digits: 0 },
    { name: 'total_distance', alias: 'total_distance', agg: 'SUM', digits: 0 },
    { name: 'tackles_won', alias: 'tackles_won', agg: 'SUM', digits: 0 },
    { name: 'sprint_distance', alias: 'sprint_distance', agg: 'SUM', digits: 0 },
  ],
  matchNames: ['minutes_played', 'total_distance', 'tackles_won', 'sprint_distance'],
  namesByUnit: () => [],
  rpeNames: [],
})

test.group('report_v4 match sport_activity_metrics', () => {
  test('selectMatchKpis returns empty when catalog has no match KPIs', ({ assert }) => {
    const empty = catalogStub()
    empty.matchKpis = []
    empty.matchNames = []
    assert.deepEqual(selectMatchKpis(empty, []), [])
    assert.deepEqual(selectMatchKpis(empty, ['minutes_played']), [])
  })

  test('selectMatchKpis prefers coach names first', ({ assert }) => {
    const selected = selectMatchKpis(catalogStub(), ['tackles_won', 'minutes_played'])
    assert.deepEqual(
      selected.slice(0, 2).map((kpi) => kpi.name),
      ['tackles_won', 'minutes_played']
    )
  })

  test('resolveCoachMetricsFromCatalog binds match phrases', ({ assert }) => {
    const resolved = resolveCoachMetricsFromCatalog({
      prompt: 'Match minutes played and tackles won this month',
      catalog: catalogStub(),
    })
    const names = preferredMatchMetricNames(resolved)
    assert.isTrue(names.includes('minutes_played'))
    assert.isTrue(names.includes('tackles_won'))
  })

  test('preferredMatchSourceFromPrompt reads vendor', ({ assert }) => {
    assert.equal(preferredMatchSourceFromPrompt('SkillCorner match distance'), 'skillcorner')
    assert.isUndefined(preferredMatchSourceFromPrompt('match minutes only'))
  })

  test('askDomainsFromHaikuJson maps match flag', ({ assert }) => {
    const domains = askDomainsFromHaikuJson({ match: true, load: false })
    assert.isTrue(domains.includes(PREMIUM_DOMAIN.MATCH))
    assert.isFalse(domains.includes(PREMIUM_DOMAIN.LOAD))
  })
})
