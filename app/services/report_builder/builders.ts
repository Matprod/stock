import { randomUUID } from 'node:crypto'
import {
  REPORT_BLOC_SPLIT,
  REPORT_BLOC_TYPE,
  REPORT_CHART_COLORS,
  REPORT_LINE_DASH_PATTERN,
  REPORT_MAX_DAILY_BAR_POINTS,
  REPORT_MAX_TIME_SERIES_CURVES,
  REPORT_SERIES_OP,
  REPORT_TIME_SERIES_POINTS,
  REPORT_VARIABLE_PREFIX,
  maxCompareAthletesFor,
} from '#constants/report_builder.constants'
import type {
  ReportBlocContent,
  ReportBlocSpec,
  ReportData,
  ReportGraphContent,
  ReportKpiContent,
  ReportKpiGroup,
  ReportSeriesSpec,
  ReportTableContent,
  ReportTextContent,
  ReportTimeSeriesCurve,
} from '#contracts/report_builder'
import type { ChartKind, IChartAxis, IChartDataset, IChartSpec } from '#contracts/chatbot'
import { toFrontendCharts } from '#utils/chart'
import {
  getComposedSeries,
  getComposedTotal,
  getSeriesUnit,
  resolveBlocSeries,
  seriesTitle,
} from '#services/report_builder/compose_series'
import { isAllReduceSeries, isReduceFormula } from '#services/report_builder/formulas'
import { parseVariableKey } from '#services/report_builder/variable_catalog'

const paletteOf = (data: ReportData): readonly string[] =>
  data.theme?.colors?.length ? data.theme.colors : REPORT_CHART_COLORS

const colorForIndex = (data: ReportData, index: number): string => {
  const palette = paletteOf(data)
  return palette[index % palette.length]
}

const colorForSeries = (data: ReportData, spec: ReportSeriesSpec, index: number): string =>
  spec.color ?? colorForIndex(data, index)

const seriesDash = (spec: ReportSeriesSpec): { borderDash?: number[] } => {
  const pattern = spec.dash ? REPORT_LINE_DASH_PATTERN[spec.dash] : undefined
  return pattern ? { borderDash: pattern } : {}
}

const axisIdForSeries = (data: ReportData, spec: ReportSeriesSpec): string => {
  const unit = getSeriesUnit(data, spec)
  return unit ? `y-${unit}` : 'y'
}

const isAthleteSplit = (bloc: ReportBlocSpec): boolean => bloc.split === REPORT_BLOC_SPLIT.ATHLETE

const athleteLabel = (data: ReportData, athleteId: string): string =>
  data.athletes[athleteId] ?? athleteId

const isTimeSeriesKey = (key: string): boolean =>
  parseVariableKey(key)?.prefix === REPORT_VARIABLE_PREFIX.TIME_SERIES

const isIntraSessionBloc = (bloc: ReportBlocSpec): boolean =>
  resolveBlocSeries(bloc).every((spec) => {
    if (spec.op === REPORT_SERIES_OP.SUM || spec.variables.length !== 1) return false
    return isTimeSeriesKey(spec.variables[0])
  })

const padElapsed = (value: number): string => String(value).padStart(2, '0')

const formatElapsed = (sec: number): string => {
  const hours = (sec / 3600) | 0
  const minutes = ((sec % 3600) / 60) | 0
  const seconds = sec % 60 | 0
  return hours
    ? `${padElapsed(hours)}:${padElapsed(minutes)}:${padElapsed(seconds)}`
    : `${padElapsed(minutes)}:${padElapsed(seconds)}`
}

const percentLabels = (): string[] =>
  Array.from(
    { length: REPORT_TIME_SERIES_POINTS },
    (_, index) => `${Math.round((100 * index) / (REPORT_TIME_SERIES_POINTS - 1))}%`
  )

const resampleCurve = (curve: ReportTimeSeriesCurve): number[] => {
  const points = curve.points
  if (!points.length) return Array.from({ length: REPORT_TIME_SERIES_POINTS }, () => 0)
  const t0 = points[0].elapsedSec
  const span = Math.max(points.at(-1)!.elapsedSec - t0, 1e-6)
  let cursor = 0
  return Array.from({ length: REPORT_TIME_SERIES_POINTS }, (_, index) => {
    const target = t0 + (span * index) / (REPORT_TIME_SERIES_POINTS - 1)
    while (cursor < points.length - 2 && points[cursor + 1].elapsedSec < target) cursor++
    const left = points[cursor]
    const right = points[Math.min(cursor + 1, points.length - 1)]
    return Math.abs(target - left.elapsedSec) <= Math.abs(target - right.elapsedSec)
      ? left.value
      : right.value
  })
}

const curvesForSpec = (
  data: ReportData,
  spec: ReportSeriesSpec,
  athleteIds?: string[]
): ReportTimeSeriesCurve[] => {
  const key = spec.variables[0]
  const curves = data.curves[key] ?? []
  if (!athleteIds?.length) return curves
  const allowed = new Set(athleteIds)
  return curves.filter((curve) => allowed.has(curve.athleteId))
}

const newestCurves = (curves: ReportTimeSeriesCurve[]): ReportTimeSeriesCurve[] =>
  [...curves]
    .sort(
      (left, right) =>
        right.date.localeCompare(left.date) || left.activityId.localeCompare(right.activityId)
    )
    .slice(0, REPORT_MAX_TIME_SERIES_CURVES)

const curveDatasetLabel = (data: ReportData, curve: ReportTimeSeriesCurve): string => {
  const name = athleteLabel(data, curve.athleteId)
  return curve.date ? `${name} (${curve.date})` : name
}

const overlayTimeSeriesChart = (
  bloc: ReportBlocSpec,
  data: ReportData,
  spec: ReportSeriesSpec,
  curves: ReportTimeSeriesCurve[]
) => {
  const axisId = axisIdForSeries(data, spec)
  const unit = getSeriesUnit(data, spec)
  return toChart({
    id: `${bloc.id}:${spec.id}`,
    kind: 'line',
    title: seriesTitle(data, spec),
    labels: percentLabels(),
    datasets: curves.map((curve, index) => {
      const color = curves.length === 1 ? colorForSeries(data, spec, 0) : colorForIndex(data, index)
      return {
        label: curveDatasetLabel(data, curve),
        data: resampleCurve(curve),
        borderColor: color,
        backgroundColor: color,
        yAxisID: axisId,
        ...seriesDash(spec),
      }
    }),
    yAxes: [{ id: axisId, label: unit ?? undefined, position: 'left' }],
    serieType: spec.variables[0],
  })
}

const sessionTimeSeriesCharts = (bloc: ReportBlocSpec, data: ReportData): ReportGraphContent => {
  const specs = resolveBlocSeries(bloc)
  const athleteIds = bloc.athleteIds
  const curvesByActivity = new Map<
    string,
    { date: string; athleteId: string; byKey: Map<string, ReportTimeSeriesCurve> }
  >()

  for (const spec of specs) {
    for (const curve of curvesForSpec(data, spec, athleteIds)) {
      const entry = curvesByActivity.get(curve.activityId) ?? {
        date: curve.date,
        athleteId: curve.athleteId,
        byKey: new Map(),
      }
      entry.byKey.set(spec.variables[0], curve)
      curvesByActivity.set(curve.activityId, entry)
    }
  }

  const sessions = [...curvesByActivity.entries()]
    .sort((left, right) => right[1].date.localeCompare(left[1].date))
    .slice(0, REPORT_MAX_TIME_SERIES_CURVES)

  return {
    charts: sessions.map(([activityId, session]) => {
      const yAxes = overlayYAxes(bloc, data)
      const firstCurve = [...session.byKey.values()][0]
      const labels = firstCurve
        ? firstCurve.points.map((point) => formatElapsed(point.elapsedSec))
        : percentLabels()

      return toChart({
        id: `${bloc.id}:${activityId}`,
        kind: 'line',
        title: `${athleteLabel(data, session.athleteId)} (${session.date})`,
        labels,
        datasets: specs.flatMap((spec, index) => {
          const curve = session.byKey.get(spec.variables[0])
          if (!curve) return []
          const color = colorForSeries(data, spec, index)
          const dataPoints =
            curve.points.length === labels.length
              ? curve.points.map((point) => point.value)
              : resampleCurve(curve)
          return [
            {
              label: seriesTitle(data, spec),
              data: dataPoints,
              borderColor: color,
              backgroundColor: color,
              yAxisID: axisIdForSeries(data, spec),
              ...seriesDash(spec),
            },
          ]
        }),
        yAxes: yAxes.length > 0 ? yAxes : undefined,
        sessionDate: session.date,
      })
    }),
  }
}

const buildTimeSeriesLineCharts = (bloc: ReportBlocSpec, data: ReportData): ReportGraphContent => {
  const specs = resolveBlocSeries(bloc)

  if (isAthleteSplit(bloc) || specs.length === 1) {
    return {
      charts: specs.map((spec) =>
        overlayTimeSeriesChart(
          bloc,
          data,
          spec,
          newestCurves(curvesForSpec(data, spec, bloc.athleteIds))
        )
      ),
    }
  }

  return sessionTimeSeriesCharts(bloc, data)
}

const overlayTitle = (bloc: ReportBlocSpec, data: ReportData): string =>
  resolveBlocSeries(bloc)
    .map((spec) => seriesTitle(data, spec))
    .join(' / ')

const overlayYAxes = (bloc: ReportBlocSpec, data: ReportData): IChartAxis[] => {
  const seen = new Set<string>()
  const axes: IChartAxis[] = []

  for (const spec of resolveBlocSeries(bloc)) {
    const id = axisIdForSeries(data, spec)
    if (seen.has(id)) continue
    seen.add(id)
    axes.push({
      id,
      label: getSeriesUnit(data, spec) ?? undefined,
      position: axes.length === 0 ? 'left' : 'right',
    })
  }

  return axes
}

const toChart = (spec: IChartSpec) => toFrontendCharts([spec])[0]

const athleteDatasets = (
  data: ReportData,
  spec: ReportSeriesSpec,
  athleteIds: string[]
): IChartDataset[] => {
  const yAxisID = axisIdForSeries(data, spec)
  return athleteIds.map((athleteId, index) => {
    const color = colorForIndex(data, index)
    return {
      label: athleteLabel(data, athleteId),
      data: getComposedSeries(data, spec, [athleteId]),
      borderColor: color,
      backgroundColor: color,
      yAxisID,
      ...seriesDash(spec),
    }
  })
}

const overlayDatasets = (bloc: ReportBlocSpec, data: ReportData): IChartDataset[] =>
  resolveBlocSeries(bloc).map((spec, index) => {
    const color = colorForSeries(data, spec, index)
    return {
      label: seriesTitle(data, spec),
      data: getComposedSeries(data, spec, bloc.athleteIds),
      borderColor: color,
      backgroundColor: color,
      yAxisID: axisIdForSeries(data, spec),
      ...seriesDash(spec),
    }
  })

const meanOfNullable = (values: Array<number | null | undefined>): number | null => {
  const finite = values.filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value)
  )
  if (finite.length === 0) return null
  return Math.round((finite.reduce((sum, value) => sum + value, 0) / finite.length) * 1000) / 1000
}

const isoWeekStart = (isoDate: string): string => {
  const date = new Date(`${isoDate}T12:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return isoDate
  const day = date.getUTCDay()
  date.setUTCDate(date.getUTCDate() - ((day + 6) % 7))
  return date.toISOString().slice(0, 10)
}

const aggregateDailyBarPoints = (
  labels: string[],
  datasets: IChartDataset[]
): { labels: string[]; datasets: IChartDataset[] } => {
  if (labels.length <= REPORT_MAX_DAILY_BAR_POINTS) return { labels, datasets }

  const order: string[] = []
  const indexBuckets = new Map<string, number[]>()
  for (const [index, label] of labels.entries()) {
    const key = isoWeekStart(label!)
    if (!indexBuckets.has(key)) {
      indexBuckets.set(key, [])
      order.push(key)
    }
    indexBuckets.get(key)!.push(index)
  }

  return {
    labels: order,
    datasets: datasets.map((dataset) => ({
      ...dataset,
      data: order.map((key) =>
        meanOfNullable(indexBuckets.get(key)!.map((index) => dataset.data[index] as number | null))
      ),
    })),
  }
}

const reduceCompareChart = (args: {
  id: string
  title: string
  labels: string[]
  values: Array<number | null>
  axisId: string
  unit: string | null | undefined
  color?: string
  palette?: ReportData
}) => {
  const color =
    args.color ?? (args.palette ? colorForIndex(args.palette, 0) : REPORT_CHART_COLORS[0])
  return toChart({
    id: args.id,
    kind: 'bar',
    title: args.title,
    labels: args.labels,
    datasets: [
      {
        label: args.title,
        data: args.values,
        borderColor: color,
        backgroundColor: color,
        yAxisID: args.axisId,
      },
    ],
    yAxes: [
      {
        id: args.axisId,
        label: args.unit ?? undefined,
        position: 'left',
      },
    ],
  })
}

const athleteReduceCompareChart = (
  bloc: ReportBlocSpec,
  data: ReportData,
  spec: ReportSeriesSpec,
  athleteIds: string[]
) =>
  reduceCompareChart({
    id: `${bloc.id}:${spec.id}`,
    title: seriesTitle(data, spec),
    labels: athleteIds.map((athleteId) => athleteLabel(data, athleteId)),
    values: athleteIds.map((athleteId) => getComposedTotal(data, spec, [athleteId])),
    axisId: axisIdForSeries(data, spec),
    unit: getSeriesUnit(data, spec),
    color: spec.color,
    palette: data,
  })

const overlayReduceCompareChart = (
  bloc: ReportBlocSpec,
  data: ReportData,
  series: ReportSeriesSpec[]
) =>
  reduceCompareChart({
    id: bloc.id || randomUUID(),
    title: overlayTitle(bloc, data),
    labels: series.map((spec) => seriesTitle(data, spec)),
    values: series.map((spec) => getComposedTotal(data, spec, bloc.athleteIds)),
    axisId: axisIdForSeries(data, series[0]!),
    unit: getSeriesUnit(data, series[0]!),
    color: series[0]?.color,
    palette: data,
  })

const buildCartesianCharts = (
  bloc: ReportBlocSpec,
  data: ReportData,
  kind: Extract<ChartKind, 'line' | 'bar'>
): ReportGraphContent => {
  const series = resolveBlocSeries(bloc)

  if (isAthleteSplit(bloc)) {
    const athleteIds = bloc.athleteIds ?? []
    const from = data.dates[0]
    const to = data.dates.at(-1)
    return {
      charts: series.map((spec) => {
        const isReduce = isReduceFormula(spec.formula)
        const visibleAthleteIds =
          kind === 'bar' && from && to
            ? athleteIds.slice(
                0,
                maxCompareAthletesFor(bloc.type, from, to, {
                  singleValue: isReduce,
                })
              )
            : athleteIds

        if (isReduce) {
          return athleteReduceCompareChart(bloc, data, spec, visibleAthleteIds)
        }

        const axisId = axisIdForSeries(data, spec)
        const datasets = athleteDatasets(data, spec, visibleAthleteIds)
        const categories =
          kind === 'bar'
            ? aggregateDailyBarPoints(data.dates, datasets)
            : { labels: data.dates, datasets }
        return toChart({
          id: `${bloc.id}:${spec.id}`,
          kind,
          title: seriesTitle(data, spec),
          labels: categories.labels,
          datasets: categories.datasets,
          yAxes: [
            {
              id: axisId,
              label: getSeriesUnit(data, spec) ?? undefined,
              position: 'left',
            },
          ],
        })
      }),
    }
  }

  if (isAllReduceSeries(series)) {
    return { charts: [overlayReduceCompareChart(bloc, data, series)] }
  }

  const yAxes = overlayYAxes(bloc, data)
  const datasets = overlayDatasets(bloc, data)
  const categories =
    kind === 'bar'
      ? aggregateDailyBarPoints(data.dates, datasets)
      : { labels: data.dates, datasets }
  return {
    charts: [
      toChart({
        id: bloc.id || randomUUID(),
        kind,
        title: overlayTitle(bloc, data),
        labels: categories.labels,
        datasets: categories.datasets,
        yAxes: yAxes.length > 0 ? yAxes : undefined,
      }),
    ],
  }
}

const pieSlicesForSeries = (
  data: ReportData,
  spec: ReportSeriesSpec,
  athleteIds: string[]
): Array<{ label: string; value: number }> =>
  athleteIds.flatMap((athleteId) => {
    const total = getComposedTotal(data, spec, [athleteId])
    if (total === null) return []
    return [{ label: athleteLabel(data, athleteId), value: total }]
  })

const overlayPieSlices = (
  bloc: ReportBlocSpec,
  data: ReportData
): Array<{ label: string; value: number }> =>
  resolveBlocSeries(bloc).flatMap((spec) => {
    const total = getComposedTotal(data, spec, bloc.athleteIds)
    if (total === null) return []
    return [{ label: seriesTitle(data, spec), value: total }]
  })

const toPieChart = (
  id: string,
  title: string,
  slices: Array<{ label: string; value: number }>,
  data: ReportData,
  color?: string
) =>
  toChart({
    id,
    kind: 'doughnut',
    title,
    labels: slices.map((slice) => slice.label),
    datasets: [
      {
        label: title,
        data: slices.map((slice) => slice.value),
        backgroundColor: color ?? colorForIndex(data, 0),
      },
    ],
  })

const buildLineChart = (bloc: ReportBlocSpec, data: ReportData): ReportGraphContent =>
  isIntraSessionBloc(bloc)
    ? buildTimeSeriesLineCharts(bloc, data)
    : buildCartesianCharts(bloc, data, 'line')

const buildBarChart = (bloc: ReportBlocSpec, data: ReportData): ReportGraphContent =>
  buildCartesianCharts(bloc, data, 'bar')

const buildPieChart = (bloc: ReportBlocSpec, data: ReportData): ReportGraphContent => {
  const series = resolveBlocSeries(bloc)

  if (isAthleteSplit(bloc)) {
    return {
      charts: series.map((spec) =>
        toPieChart(
          `${bloc.id}:${spec.id}`,
          seriesTitle(data, spec),
          pieSlicesForSeries(data, spec, bloc.athleteIds ?? []),
          data,
          spec.color
        )
      ),
    }
  }

  const title = overlayTitle(bloc, data)
  return {
    charts: [
      toPieChart(
        bloc.id || randomUUID(),
        title,
        overlayPieSlices(bloc, data),
        data,
        series[0]?.color
      ),
    ],
  }
}

const athleteKpiGroup = (
  data: ReportData,
  spec: ReportSeriesSpec,
  athleteIds: string[]
): ReportKpiGroup => ({
  key: spec.id,
  label: seriesTitle(data, spec),
  items: athleteIds.map((athleteId) => ({
    key: athleteId,
    label: athleteLabel(data, athleteId),
    value: getComposedTotal(data, spec, [athleteId]),
    unit: getSeriesUnit(data, spec),
  })),
})

const buildKpi = (bloc: ReportBlocSpec, data: ReportData): ReportKpiContent => {
  const series = resolveBlocSeries(bloc)

  if (isAthleteSplit(bloc)) {
    return {
      groups: series.map((spec) => athleteKpiGroup(data, spec, bloc.athleteIds ?? [])),
    }
  }

  return {
    groups: [
      {
        key: bloc.id,
        label: overlayTitle(bloc, data),
        items: series.map((spec) => ({
          key: spec.id,
          label: seriesTitle(data, spec),
          value: getComposedTotal(data, spec, bloc.athleteIds),
          unit: getSeriesUnit(data, spec),
        })),
      },
    ],
  }
}

const buildText = (bloc: ReportBlocSpec): ReportTextContent => ({
  text: bloc.text ?? '',
})

const buildTable = (bloc: ReportBlocSpec, data: ReportData): ReportTableContent => {
  const allowed = bloc.athleteIds?.length ? new Set(bloc.athleteIds) : null
  for (const spec of resolveBlocSeries(bloc)) {
    const table = data.tables[spec.variables[0] ?? '']
    if (!table) continue
    const rows = allowed ? table.rows.filter((row) => allowed.has(row.athleteId)) : table.rows
    return {
      title: seriesTitle(data, spec),
      columns: table.columns,
      rows,
    }
  }
  return { columns: [], rows: [] }
}

export const blocBuilders = {
  [REPORT_BLOC_TYPE.LINE_CHART]: buildLineChart,
  [REPORT_BLOC_TYPE.BAR_CHART]: buildBarChart,
  [REPORT_BLOC_TYPE.PIE_CHART]: buildPieChart,
  [REPORT_BLOC_TYPE.KPI]: buildKpi,
  [REPORT_BLOC_TYPE.TABLE]: buildTable,
  [REPORT_BLOC_TYPE.TEXT]: (bloc: ReportBlocSpec, _data: ReportData) => buildText(bloc),
} as const

export type BuilderBlocType = keyof typeof blocBuilders

export const buildBloc = (bloc: ReportBlocSpec, data: ReportData): ReportBlocContent =>
  blocBuilders[bloc.type](bloc, data)
