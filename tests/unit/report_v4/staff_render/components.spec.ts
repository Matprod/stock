import { test } from '@japa/runner'
import {
  renderBarPanels,
  renderCallout,
  renderCoverageTable,
  renderDataTable,
  renderFindings,
  renderHeatmap,
  renderKeyFigures,
  renderLineChart,
  renderMasthead,
  renderNotProducedBlock,
  renderReferenceBlock,
  renderWatchCard,
} from '#services/report_v4/staff_render/components/index'
import {
  dayLabelsShort,
  formatKpi,
  loadHambourgFixture,
  teamDailyMeans,
  topRiskAthletes,
} from '#services/report_v4/staff_render/hambourg_fixture'
import { formatStaffDateRange, formatStaffNumber } from '#services/report_v4/staff_render/format'
import { assertHtmlSnapshot } from './snapshot_helper.js'

test.group('staff_render components (fixture snapshots)', () => {
  const fixture = loadHambourgFixture()
  const days = dayLabelsShort(fixture.days)
  const watch = topRiskAthletes(fixture, 2)
  const poulsen = watch.find((row) => row.name.includes('Poulsen')) ?? watch[0]!
  const jatta = watch.find((row) => row.name.includes('Jatta')) ?? watch[1]!

  test('Masthead snapshot + empty', ({ assert }) => {
    assertHtmlSnapshot(
      assert,
      'masthead',
      renderMasthead({
        eyebrow: 'Rapport staff',
        title: 'Deux joueurs à risque élevé sur la semaine',
        subtitle: formatStaffDateRange(fixture.window.start, fixture.window.end),
      })
    )
    assert.include(renderMasthead({ title: '' }), 'data-empty="true"')
  })

  test('KeyFigures snapshot + empty', ({ assert }) => {
    assertHtmlSnapshot(
      assert,
      'key_figures',
      renderKeyFigures({
        figures: [
          {
            label: 'Performance moyenne',
            value: formatKpi(fixture.kpi_reported.mean_performance),
            unit: '/100',
          },
          {
            label: 'Risque moyen',
            value: formatKpi(fixture.kpi_reported.mean_injury_risk),
            unit: '/100',
          },
          {
            label: 'Distance moyenne',
            value: formatStaffNumber(fixture.kpi_reported.mean_total_distance_m, {
              maximumFractionDigits: 0,
            }),
            unit: 'm',
          },
          {
            label: 'Joueurs scorés',
            value: `${fixture.players_scored}`,
            unit: `/ ${fixture.players_gps}`,
          },
        ],
      })
    )
    assert.include(renderKeyFigures({ figures: [] }), 'data-empty="true"')
  })

  test('Findings snapshot + empty', ({ assert }) => {
    assertHtmlSnapshot(
      assert,
      'findings',
      renderFindings({
        items: [
          {
            text: `${poulsen.name} : risque moyen ${formatKpi(poulsen.mean)}, tendance ${poulsen.trend}.`,
          },
          {
            text: `${jatta.name} : risque moyen ${formatKpi(jatta.mean)}, tendance ${jatta.trend}.`,
          },
          {
            text: `Couverture scores : ${fixture.players_scored} joueurs sur ${fixture.players_gps}.`,
          },
        ],
      })
    )
    assert.include(renderFindings({ items: [] }), 'data-empty="true"')
  })

  test('WatchCard snapshot + empty', ({ assert }) => {
    assertHtmlSnapshot(
      assert,
      'watch_card_poulsen',
      renderWatchCard({
        name: poulsen.name,
        position: fixture.gps_sessions[poulsen.name]?.position ?? 'Striker',
        valueLabel: 'Risque moyen',
        value: formatKpi(poulsen.mean),
        trend: poulsen.trend,
        series: poulsen.values,
        note: 'Tendance calculée sur la fenêtre 1–7 mars.',
        sheetHref: '#fiche-poulsen',
      })
    )
    assert.include(renderWatchCard({
      name: '',
      valueLabel: '',
      value: '',
      trend: 'flat',
      series: [],
    }), 'data-empty="true"')
  })

  test('LineChart snapshot + empty', ({ assert }) => {
    assertHtmlSnapshot(
      assert,
      'line_chart_watch',
      renderLineChart({
        title: 'Risque — Poulsen / Jatta',
        categories: days,
        series: [
          { id: 'poulsen', label: 'Poulsen', kind: 'risk', values: poulsen.values },
          { id: 'jatta', label: 'Jatta', kind: 'risk', values: jatta.values },
        ],
        sessionIndexes: [0, 1, 2, 3, 4, 5],
        annotations: [{ type: 'brace', fromIndex: 3, toIndex: 6, label: 'hausse' }],
      })
    )
    assert.include(renderLineChart({ categories: [], series: [] }), 'data-empty="true"')
  })

  test('Heatmap snapshot + empty', ({ assert }) => {
    const rows = Object.entries(fixture.scores.injury_risk).map(([label, values]) => ({
      label,
      values,
    }))
    assertHtmlSnapshot(
      assert,
      'heatmap_risk',
      renderHeatmap({
        title: 'Matrice risque',
        days,
        rows,
        teamValues: teamDailyMeans(fixture.scores.injury_risk),
      })
    )
    assert.include(renderHeatmap({ days: [], rows: [] }), 'data-empty="true"')
  })

  test('BarPanels snapshot + empty', ({ assert }) => {
    const usable = fixture.gps_by_position.filter((row) => !row.excluded)
    assertHtmlSnapshot(
      assert,
      'bar_panels_gps',
      renderBarPanels({
        panels: [
          {
            title: 'Distance totale',
            unit: 'm',
            items: usable.map((row) => ({
              label: row.position,
              value: row.total_distance_m,
            })),
          },
          {
            title: 'Distance explosive',
            unit: 'm',
            items: usable.map((row) => ({
              label: row.position,
              value: row.explosive,
            })),
          },
        ],
      })
    )
    assert.include(renderBarPanels({ panels: [] }), 'data-empty="true"')
  })

  test('DataTable snapshot + empty', ({ assert }) => {
    const sessions = fixture.gps_sessions['Yussuf Poulsen']!.sessions
    assertHtmlSnapshot(
      assert,
      'data_table_poulsen_gps',
      renderDataTable({
        title: 'GPS Poulsen',
        columns: [
          { key: 'date', label: 'Date' },
          { key: 'distance', label: 'Distance', numeric: true },
          { key: 'hmld', label: 'HMLD', numeric: true },
          { key: 'explosive', label: 'Explosive', numeric: true },
        ],
        rows: sessions.map((row) => ({
          date: row.date,
          distance: row.distance,
          hmld: row.hmld,
          explosive: row.explosive,
        })),
        showMeanRow: true,
      })
    )
    assert.include(renderDataTable({ columns: [], rows: [] }), 'data-empty="true"')
  })

  test('Callout Coverage NotProduced Reference snapshots + empty', ({ assert }) => {
    assertHtmlSnapshot(
      assert,
      'callout_data',
      renderCallout({
        kind: 'data_show',
        body: `Poulsen ${formatKpi(poulsen.mean)} ; Jatta ${formatKpi(jatta.mean)}.`,
      })
    )
    assert.include(renderCallout({ kind: 'verify', body: '' }), 'data-empty="true"')

    assertHtmlSnapshot(
      assert,
      'coverage_table',
      renderCoverageTable({
        rows: [
          {
            domain: 'Scores ML',
            status: 'partial',
            source: 'daily_scores',
            available: `${fixture.players_scored} joueurs`,
            missing: `${fixture.players_gps - fixture.players_scored} sans score`,
          },
          {
            domain: 'VALD',
            status: 'limited',
            source: 'vald_tests',
            available: '—',
            missing: 'aucune séance sur la fenêtre',
          },
          {
            domain: 'GPS',
            status: 'complete',
            source: 'gps_intensity_daily',
            available: 'postes renseignés',
            missing: 'Midfielder n=1 exclu',
          },
        ],
      })
    )
    assert.include(renderCoverageTable({ rows: [] }), 'data-empty="true"')

    assertHtmlSnapshot(
      assert,
      'not_produced',
      renderNotProducedBlock({
        title: 'Sommeil × humeur',
        reason: 'Nuage de points non tracé : jointure sommeil/humeur incomplète.',
      })
    )
    assert.include(renderNotProducedBlock({ title: '' }), 'data-empty="true"')

    assertHtmlSnapshot(
      assert,
      'reference_block',
      renderReferenceBlock({
        title: 'Boisson énergisante (exemple)',
        body: 'Référence produit générale — hors monitoring club.',
      })
    )
    assert.include(renderReferenceBlock({ title: '', body: '' }), 'data-empty="true"')
  })
})
