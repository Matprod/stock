import {
  athleteMean,
  dayLabelsShort,
  loadHambourgFixture,
  teamDailyMeans,
  topRiskAthletes,
  type HambourgFixture,
} from '#services/report_v4/staff_render/hambourg_fixture'
import { formatStaffDateRange } from '#services/report_v4/staff_render/format'
import type { StaffFact } from '#services/report_v4/staff_render/facts_bind'
import type { StaffReportDocument } from '#services/report_v4/staff_render/schema'

export const buildHambourgStaffFacts = (fixture: HambourgFixture = loadHambourgFixture()): Map<string, StaffFact> => {
  const watch = topRiskAthletes(fixture, 2)
  const poulsen = watch.find((row) => row.name.includes('Poulsen')) ?? watch[0]!
  const jatta = watch.find((row) => row.name.includes('Jatta')) ?? watch[1]!
  const facts = new Map<string, StaffFact>()
  const put = (id: string, value: number, digits?: number) => {
    facts.set(id, { id, value, digits })
  }
  put('kpi.performance_mean', fixture.kpi_reported.mean_performance, 1)
  put('kpi.risk_mean', fixture.kpi_reported.mean_injury_risk, 2)
  put('kpi.distance_mean', fixture.kpi_reported.mean_total_distance_m, 0)
  put('coverage.players_scored', fixture.players_scored, 0)
  put('coverage.players_roster', fixture.players_gps, 0)
  put('poulsen.risque_moyen', poulsen.mean, 1)
  put('jatta.risque_moyen', jatta.mean, 1)
  put('poulsen.perf_mean', athleteMean(fixture.scores.performance[poulsen.name] ?? []), 1)
  put('jatta.perf_mean', athleteMean(fixture.scores.performance[jatta.name] ?? []), 1)
  return facts
}

export const buildHambourgReferenceDocument = (
  fixture: HambourgFixture = loadHambourgFixture()
): StaffReportDocument => {
  const days = dayLabelsShort(fixture.days)
  const watch = topRiskAthletes(fixture, 2)
  const poulsen = watch.find((row) => row.name.includes('Poulsen')) ?? watch[0]!
  const jatta = watch.find((row) => row.name.includes('Jatta')) ?? watch[1]!
  const usableGps = fixture.gps_by_position.filter((row) => !row.excluded)
  const range = formatStaffDateRange(fixture.window.start, fixture.window.end)

  return {
    clubName: 'Hambourg',
    language: 'fr',
    pages: [
      {
        headerLeft: 'Hambourg',
        headerRight: range,
        blocks: [
          {
            component: 'Masthead',
            data: {
              eyebrow: 'Rapport staff',
              title: 'Deux joueurs à risque élevé sur la semaine',
              subtitle: range,
            },
          },
          {
            component: 'KeyFigures',
            data: {
              figures: [
                {
                  label: 'Performance moyenne',
                  value: '{{fait:kpi.performance_mean}}',
                  unit: '/100',
                },
                { label: 'Risque moyen', value: '{{fait:kpi.risk_mean}}', unit: '/100' },
                {
                  label: 'Distance moyenne',
                  value: '{{fait:kpi.distance_mean}}',
                  unit: 'm',
                },
                {
                  label: 'Joueurs scorés',
                  value: '{{fait:coverage.players_scored}}',
                  unit: '/ {{fait:coverage.players_roster}}',
                },
              ],
            },
          },
          {
            component: 'Findings',
            data: {
              items: [
                {
                  text: `${poulsen.name} : risque moyen {{fait:poulsen.risque_moyen}}, tendance ${poulsen.trend}.`,
                },
                {
                  text: `${jatta.name} : risque moyen {{fait:jatta.risque_moyen}}, tendance ${jatta.trend}.`,
                },
                {
                  text: 'Couverture scores : {{fait:coverage.players_scored}} joueurs sur {{fait:coverage.players_roster}}.',
                },
              ],
            },
          },
          {
            component: 'WatchCard',
            data: {
              name: poulsen.name,
              position: fixture.gps_sessions[poulsen.name]?.position ?? 'Striker',
              valueLabel: 'Risque moyen',
              value: '{{fait:poulsen.risque_moyen}}',
              trend: poulsen.trend,
              series: poulsen.values,
              note: 'Tendance calculée par le code sur la fenêtre principale.',
              sheetHref: '#fiche-poulsen',
            },
          },
          {
            component: 'WatchCard',
            data: {
              name: jatta.name,
              position: fixture.gps_sessions[jatta.name]?.position ?? 'Winger',
              valueLabel: 'Risque moyen',
              value: '{{fait:jatta.risque_moyen}}',
              trend: jatta.trend,
              series: jatta.values,
              note: 'Volume GPS élevé aligné avec les leviers club.',
              sheetHref: '#fiche-jatta',
            },
          },
        ],
      },
      {
        headerLeft: 'Scores',
        headerRight: range,
        blocks: [
          {
            component: 'LineChart',
            data: {
              title: 'Risque — Poulsen / Jatta',
              categories: days,
              series: [
                { id: 'poulsen', label: 'Poulsen', kind: 'risk', values: poulsen.values },
                { id: 'jatta', label: 'Jatta', kind: 'risk', values: jatta.values },
              ],
              sessionIndexes: [0, 1, 2, 3, 4, 5],
            },
          },
          {
            component: 'Heatmap',
            data: {
              title: 'Matrice risque',
              days,
              rows: Object.entries(fixture.scores.injury_risk).map(([label, values]) => ({
                label,
                values,
              })),
              teamValues: teamDailyMeans(fixture.scores.injury_risk),
            },
          },
        ],
      },
      {
        headerLeft: 'GPS',
        headerRight: range,
        blocks: [
          {
            component: 'BarPanels',
            data: {
              panels: [
                {
                  title: 'Distance totale',
                  unit: 'm',
                  items: usableGps.map((row) => ({
                    label: row.position,
                    value: row.total_distance_m,
                  })),
                },
                {
                  title: 'Distance explosive',
                  unit: 'm',
                  items: usableGps.map((row) => ({
                    label: row.position,
                    value: row.explosive,
                  })),
                },
              ],
            },
          },
          {
            component: 'DataTable',
            data: {
              title: 'GPS Poulsen',
              columns: [
                { key: 'date', label: 'Date' },
                { key: 'distance', label: 'Distance', numeric: true },
                { key: 'hmld', label: 'HMLD', numeric: true },
                { key: 'explosive', label: 'Explosive', numeric: true },
              ],
              rows: (fixture.gps_sessions['Yussuf Poulsen']?.sessions ?? []).map((row) => ({
                date: row.date,
                distance: row.distance,
                hmld: row.hmld,
                explosive: row.explosive,
              })),
              showMeanRow: true,
            },
          },
          {
            component: 'Callout',
            data: {
              kind: 'data_show',
              body: 'Moyennes fixture : performance {{fait:kpi.performance_mean}}, risque {{fait:kpi.risk_mean}}, distance {{fait:kpi.distance_mean}} m.',
            },
          },
        ],
      },
      {
        headerLeft: 'Couverture',
        headerRight: range,
        blocks: [
          {
            component: 'CoverageTable',
            data: {
              rows: [
                {
                  domain: 'Scores ML',
                  status: 'partial',
                  source: 'daily_scores',
                  available: '{{fait:coverage.players_scored}} joueurs',
                  missing: 'reste du roster sans score sur la fenêtre',
                },
                {
                  domain: 'VALD',
                  status: 'limited',
                  source: 'vald_tests',
                  available: '—',
                  missing: 'aucune séance',
                },
                {
                  domain: 'Sommeil × humeur',
                  status: 'limited',
                  source: 'sleep/wellness',
                  available: 'quality / mood',
                  missing: fixture.sleep.missing.join(', '),
                },
              ],
            },
          },
          {
            component: 'NotProducedBlock',
            data: {
              title: 'Sommeil × humeur',
              reason: 'Nuage de points non tracé — jointure incomplète.',
            },
          },
          {
            component: 'ReferenceBlock',
            data: {
              title: 'Référence produit (exemple)',
              body: 'Hors données du club — ne pas traiter comme un monitoring nutrition.',
            },
          },
        ],
      },
    ],
  }
}
