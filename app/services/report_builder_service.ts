import { Exception } from '@adonisjs/core/exceptions'
import { DateTime } from 'luxon'
import type { AppLanguage } from '#utils/localize'
import {
  REPORT_BINARY_SERIES_OPS,
  REPORT_BLOC_SPLIT,
  REPORT_MAX_COMPARE_VARIABLES,
  REPORT_MAX_SERIES_SOURCES,
  REPORT_SERIES_OP,
  REPORT_SERIES_OPS,
  REPORT_TEXT_MAX_LENGTH,
  REPORT_VARIABLE_PREFIX,
  isReportTextBloc,
  maxCompareAthletesFor,
  parseReportColor,
  parseReportLineDash,
  type ReportBinarySeriesOp,
  type ReportSeriesOp,
} from '#constants/report_builder.constants'
import type {
  ReportBlocSpec,
  ReportCatalog,
  ReportDateRange,
  ReportDocument,
  ReportFormulaSpec,
  ReportGenerateInput,
  ReportSeriesSpec,
  ReportTemplate,
  ReportTheme,
  ReportVariableDefinition,
} from '#contracts/report_builder'
import Athlete from '#models_pg/athlete'
import Club from '#models_pg/club'
import Report from '#models_pg/report'
import { buildBloc } from '#services/report_builder/builders'
import {
  isAllReduceSeries,
  isReportFormulaId,
  normalizeFormulaSpec,
  REPORT_FORMULAS,
} from '#services/report_builder/formulas'
import { loadReportData, sliceReportData } from '#services/report_builder/load_report_data'
import { renderReportPdf, type ReportPdfFile } from '#services/report_builder/pdf/pdf_renderer'
import { parseConvertUnit, unitConversionFactor } from '#services/report_builder/report_units'
import {
  buildVariableCatalog,
  parseVariableKey,
  resolveVariableDefinitions,
} from '#services/report_builder/variable_catalog'

const DEFAULT_REPORT_TITLE = 'Untitled'

const normalizeAthleteIds = (athleteIds?: string[]): string[] | undefined => {
  if (!athleteIds?.length) return undefined
  return [...new Set(athleteIds)]
}

const collectBlocKeys = (bloc: ReportBlocSpec): string[] => [
  ...(bloc.variables ?? []),
  ...(bloc.series ?? []).flatMap((series) => series.variables),
]

const toIdentitySeries = (keys: string[]): ReportSeriesSpec[] =>
  [...new Set(keys)].map((key) => ({
    id: key,
    op: REPORT_SERIES_OP.IDENTITY,
    variables: [key],
  }))

const isBinaryOp = (op: string): op is ReportBinarySeriesOp =>
  REPORT_BINARY_SERIES_OPS.includes(op as ReportBinarySeriesOp)

const normalizeFormula = (
  formula: ReportFormulaSpec | undefined,
  variables: string[]
): ReportFormulaSpec | undefined => {
  if (!formula) return undefined
  if (!isReportFormulaId(formula.id)) {
    throw new Exception(`Unknown series formula: ${formula.id}`, { status: 422 })
  }
  const isTimeSeries = variables.some(
    (key) => parseVariableKey(key)?.prefix === REPORT_VARIABLE_PREFIX.TIME_SERIES
  )
  if (isTimeSeries && REPORT_FORMULAS[formula.id].kind === 'reduce') {
    throw new Exception('reduce formulas are not supported on time-series variables', {
      status: 422,
    })
  }
  return normalizeFormulaSpec(formula)
}

const normalizeSeriesSpec = (
  spec: ReportSeriesSpec,
  definitions: Map<string, ReportVariableDefinition>
): ReportSeriesSpec => {
  const rawOp = spec.op ?? REPORT_SERIES_OP.IDENTITY
  const op: ReportSeriesOp = REPORT_SERIES_OPS.includes(rawOp) ? rawOp : REPORT_SERIES_OP.IDENTITY
  const variables = [...new Set(spec.variables)]

  if (op === REPORT_SERIES_OP.IDENTITY && variables.length !== 1) {
    throw new Exception('identity series requires exactly 1 variable', { status: 422 })
  }
  if (op === REPORT_SERIES_OP.SUM && variables.length < 2) {
    throw new Exception('sum series requires at least 2 variables', { status: 422 })
  }
  if (isBinaryOp(op) && variables.length !== 2) {
    throw new Exception(`${op} series requires exactly 2 variables`, { status: 422 })
  }
  if (variables.length > REPORT_MAX_SERIES_SOURCES) {
    throw new Exception(`a series supports at most ${REPORT_MAX_SERIES_SOURCES} variables`, {
      status: 422,
    })
  }

  if (op === REPORT_SERIES_OP.SUM || op === REPORT_SERIES_OP.SUB) {
    const units = variables.map((key) => definitions.get(key)?.unit ?? null)
    if (units.some((unit) => unit !== units[0])) {
      throw new Exception(`${op} series ${spec.id} mixes incompatible units`, { status: 422 })
    }
  }

  const formula = normalizeFormula(spec.formula, variables)
  const color = parseReportColor(spec.color)
  const convert = parseConvertUnit(spec.convert)
  const dash = parseReportLineDash(spec.dash)
  if (convert) {
    const fromUnit = definitions.get(variables[0])?.unit ?? null
    if (unitConversionFactor(fromUnit, convert) === null) {
      throw new Exception(`Cannot convert ${fromUnit ?? 'unknown unit'} to ${convert}`, {
        status: 422,
      })
    }
  }

  return {
    id: spec.id,
    ...(spec.label ? { label: spec.label } : {}),
    op,
    variables,
    ...(formula ? { formula } : {}),
    ...(convert ? { convert } : {}),
    ...(color ? { color } : {}),
    ...(dash ? { dash } : {}),
  }
}

const normalizeBlocSeries = (
  bloc: ReportBlocSpec,
  definitions: Map<string, ReportVariableDefinition>
): ReportSeriesSpec[] => {
  const source = bloc.series?.length ? bloc.series : toIdentitySeries(bloc.variables ?? [])
  if (source.length === 0) {
    throw new Exception('Each bloc requires variables or series', { status: 422 })
  }

  const series = source.map((spec) => normalizeSeriesSpec(spec, definitions))
  const ids = series.map((spec) => spec.id)
  if (new Set(ids).size !== ids.length) {
    throw new Exception('series ids must be unique within a bloc', { status: 422 })
  }

  return series
}

const timeSeriesAthleteScope = (blocs: ReportBlocSpec[]): string[] | undefined => {
  const timeSeriesBlocs = blocs.filter((bloc) =>
    (bloc.variables ?? []).some(
      (key) => parseVariableKey(key)?.prefix === REPORT_VARIABLE_PREFIX.TIME_SERIES
    )
  )
  if (timeSeriesBlocs.length === 0) return undefined
  if (timeSeriesBlocs.some((bloc) => !bloc.athleteIds?.length)) return undefined
  return [...new Set(timeSeriesBlocs.flatMap((bloc) => bloc.athleteIds ?? []))]
}

const assertValidDateRange = (dateRange: ReportDateRange) => {
  const from = DateTime.fromISO(dateRange.from).startOf('day')
  const to = DateTime.fromISO(dateRange.to).startOf('day')
  if (!from.isValid || !to.isValid || to < from) {
    throw new Exception('Invalid date range', { status: 400 })
  }
}

const rangesEqual = (left: ReportDateRange, right: ReportDateRange): boolean =>
  left.from === right.from && left.to === right.to

const clampToOuterRange = (inner: ReportDateRange, outer: ReportDateRange): ReportDateRange => ({
  from: inner.from < outer.from ? outer.from : inner.from,
  to: inner.to > outer.to ? outer.to : inner.to,
})

const normalizeBlocDateRange = (
  blocRange: ReportDateRange | undefined,
  reportRange: ReportDateRange
): ReportDateRange | undefined => {
  if (!blocRange) return undefined
  assertValidDateRange(blocRange)
  const clamped = clampToOuterRange(blocRange, reportRange)
  if (clamped.from > clamped.to) {
    throw new Exception('Bloc date range is outside the report window', { status: 422 })
  }
  if (rangesEqual(clamped, reportRange)) return undefined
  return clamped
}

const serializeReport = (report: Report): ReportTemplate => ({
  id: report.id,
  title: report.title,
  dateRange: {
    from: report.dateFrom.toISODate()!,
    to: report.dateTo.toISODate()!,
  },
  blocs: report.blocs,
  createdBy: report.createdBy,
  createdAt: report.createdAt.toISO()!,
  updatedAt: report.updatedAt.toISO()!,
})

export default class ReportBuilderService {
  async getCatalog(
    clubId: string,
    language: AppLanguage,
    dateRange?: ReportDateRange,
    useImputedMetrics = false
  ): Promise<ReportCatalog> {
    if (dateRange) assertValidDateRange(dateRange)
    return buildVariableCatalog(clubId, language, dateRange, useImputedMetrics)
  }

  async generate(clubId: string, input: ReportGenerateInput): Promise<ReportDocument> {
    assertValidDateRange(input.dateRange)

    const { blocs, definitions, athletes } = await this.normalizeBlocs(
      clubId,
      input.blocs,
      input.dateRange
    )
    const timeSeriesAthleteIds = timeSeriesAthleteScope(blocs)
    const theme: ReportTheme | undefined = input.theme?.colors?.length
      ? { colors: input.theme.colors }
      : undefined
    const reportData =
      definitions.size === 0
        ? {
            dates: [],
            points: {},
            curves: {},
            tables: {},
            meta: {},
            athletes,
            theme,
          }
        : await loadReportData(
            clubId,
            input.dateRange,
            [...definitions.values()],
            timeSeriesAthleteIds,
            input.useImputedMetrics === true
          )
    reportData.athletes = { ...reportData.athletes, ...athletes }
    if (theme) reportData.theme = theme

    return {
      title: input.title,
      dateRange: input.dateRange,
      ...(theme ? { theme } : {}),
      blocs: blocs.map((bloc) => ({
        id: bloc.id,
        type: bloc.type,
        variables: bloc.variables ?? [],
        series: bloc.series ?? [],
        athleteIds: bloc.athleteIds,
        split: bloc.split ?? REPORT_BLOC_SPLIT.VARIABLE,
        dateRange: bloc.dateRange,
        ...(bloc.text ? { text: bloc.text } : {}),
        content: isReportTextBloc(bloc.type)
          ? { text: bloc.text ?? '' }
          : buildBloc(bloc, sliceReportData(reportData, bloc.dateRange ?? input.dateRange)),
      })),
    }
  }

  async normalizeInput(clubId: string, input: ReportGenerateInput): Promise<ReportGenerateInput> {
    assertValidDateRange(input.dateRange)
    const { blocs } = await this.normalizeBlocs(clubId, input.blocs, input.dateRange)
    return {
      title: input.title,
      dateRange: input.dateRange,
      blocs,
      ...(input.theme?.colors?.length ? { theme: { colors: input.theme.colors } } : {}),
      useImputedMetrics: input.useImputedMetrics === true,
    }
  }

  async create(
    clubId: string,
    userId: string,
    input: ReportGenerateInput
  ): Promise<ReportTemplate> {
    assertValidDateRange(input.dateRange)
    const { blocs } = await this.normalizeBlocs(clubId, input.blocs, input.dateRange)

    const report = await Report.create({
      clubId,
      createdBy: userId,
      title: input.title ?? DEFAULT_REPORT_TITLE,
      dateFrom: DateTime.fromISO(input.dateRange.from),
      dateTo: DateTime.fromISO(input.dateRange.to),
      blocs,
    })

    return serializeReport(report)
  }

  async list(clubId: string): Promise<ReportTemplate[]> {
    const reports = await Report.query().where('clubId', clubId).orderBy('updatedAt', 'desc')
    return reports.map(serializeReport)
  }

  async getOne(clubId: string, reportId: string): Promise<ReportTemplate> {
    const report = await this.findOwned(clubId, reportId)
    return serializeReport(report)
  }

  async update(
    clubId: string,
    reportId: string,
    input: ReportGenerateInput
  ): Promise<ReportTemplate> {
    assertValidDateRange(input.dateRange)
    const { blocs } = await this.normalizeBlocs(clubId, input.blocs, input.dateRange)

    const report = await this.findOwned(clubId, reportId)
    report.title = input.title ?? report.title
    report.dateFrom = DateTime.fromISO(input.dateRange.from)
    report.dateTo = DateTime.fromISO(input.dateRange.to)
    report.blocs = blocs
    await report.save()

    return serializeReport(report)
  }

  async delete(clubId: string, reportId: string): Promise<void> {
    const report = await this.findOwned(clubId, reportId)
    await report.delete()
  }

  async generateFromSaved(clubId: string, reportId: string): Promise<ReportDocument> {
    const report = await this.findOwned(clubId, reportId)
    return this.generate(clubId, {
      title: report.title,
      dateRange: {
        from: report.dateFrom.toISODate()!,
        to: report.dateTo.toISODate()!,
      },
      blocs: report.blocs,
    })
  }

  async exportPdf(
    clubId: string,
    input: ReportGenerateInput,
    language: AppLanguage
  ): Promise<ReportPdfFile> {
    const document = await this.generate(clubId, input)
    return this.renderPdf(clubId, document, language)
  }

  async exportPdfFromSaved(
    clubId: string,
    reportId: string,
    language: AppLanguage
  ): Promise<ReportPdfFile> {
    const document = await this.generateFromSaved(clubId, reportId)
    return this.renderPdf(clubId, document, language)
  }

  private async renderPdf(
    clubId: string,
    document: ReportDocument,
    language: AppLanguage
  ): Promise<ReportPdfFile> {
    const club = await Club.query().where('id', clubId).select('id', 'name').first()
    return renderReportPdf(document, {
      clubName: club?.name ?? '',
      language,
      generatedAt: DateTime.now(),
    })
  }

  private async findOwned(clubId: string, reportId: string): Promise<Report> {
    const report = await Report.query().where('id', reportId).where('clubId', clubId).first()
    if (!report) {
      throw new Exception('Report not found', { status: 404 })
    }
    return report
  }

  private async normalizeBlocs(
    clubId: string,
    blocs: ReportBlocSpec[],
    reportRange: ReportDateRange
  ): Promise<{
    blocs: ReportBlocSpec[]
    definitions: Map<string, ReportVariableDefinition>
    athletes: Record<string, string>
  }> {
    const keys = [...new Set(blocs.flatMap(collectBlocKeys))]
    const hasTextOnly = blocs.length > 0 && blocs.every((bloc) => isReportTextBloc(bloc.type))
    if (keys.length === 0 && !hasTextOnly) {
      throw new Exception('Each bloc requires variables, series or text', { status: 422 })
    }

    const definitions =
      keys.length === 0
        ? new Map<string, ReportVariableDefinition>()
        : await resolveVariableDefinitions(keys)
    const unknownKeys = keys.filter((key) => !definitions.has(key))
    if (unknownKeys.length > 0) {
      throw new Exception(`Unknown report variables: ${unknownKeys.join(', ')}`, { status: 422 })
    }

    const normalizedBlocs = blocs.map((bloc) => {
      if (isReportTextBloc(bloc.type)) {
        const text = (bloc.text ?? '').trim().slice(0, REPORT_TEXT_MAX_LENGTH)
        if (!text) {
          throw new Exception('text bloc requires text', { status: 422 })
        }
        return {
          id: bloc.id,
          type: bloc.type,
          text,
          variables: [],
          series: [],
          athleteIds: undefined,
          split: REPORT_BLOC_SPLIT.VARIABLE,
          dateRange: normalizeBlocDateRange(bloc.dateRange, reportRange),
        }
      }

      const athleteIds = normalizeAthleteIds(bloc.athleteIds)
      const split =
        bloc.split === REPORT_BLOC_SPLIT.ATHLETE
          ? REPORT_BLOC_SPLIT.ATHLETE
          : REPORT_BLOC_SPLIT.VARIABLE
      const series = normalizeBlocSeries(bloc, definitions)
      const variables = [...new Set(series.flatMap((item) => item.variables))]

      if (split === REPORT_BLOC_SPLIT.ATHLETE) {
        if (!athleteIds || athleteIds.length < 2) {
          throw new Exception('split athlete requires at least 2 athletes', { status: 422 })
        }
        const range = bloc.dateRange ?? reportRange
        const maxAthletes = maxCompareAthletesFor(bloc.type, range.from, range.to, {
          singleValue: isAllReduceSeries(series),
        })
        if (Number.isFinite(maxAthletes) && athleteIds.length > maxAthletes) {
          throw new Exception(`split athlete supports at most ${maxAthletes} athletes`, {
            status: 422,
          })
        }
        if (series.length > REPORT_MAX_COMPARE_VARIABLES) {
          throw new Exception(
            `split athlete supports at most ${REPORT_MAX_COMPARE_VARIABLES} series`,
            { status: 422 }
          )
        }
      }

      return {
        ...bloc,
        variables,
        series,
        athleteIds,
        split,
        dateRange: normalizeBlocDateRange(bloc.dateRange, reportRange),
      }
    })

    const athleteIds = [...new Set(normalizedBlocs.flatMap((bloc) => bloc.athleteIds ?? []))]
    const athletes: Record<string, string> = {}
    if (athleteIds.length > 0) {
      const rows = await Athlete.query()
        .where('clubId', clubId)
        .whereIn('id', athleteIds)
        .select('id', 'firstName', 'lastName')
      const knownIds = new Set(rows.map((athlete) => athlete.id))
      const unknownIds = athleteIds.filter((id) => !knownIds.has(id))
      if (unknownIds.length > 0) {
        throw new Exception(`Unknown athletes: ${unknownIds.join(', ')}`, { status: 422 })
      }
      for (const athlete of rows) {
        athletes[athlete.id] =
          `${athlete.firstName ?? ''} ${athlete.lastName ?? ''}`.replace(/\s+/g, ' ').trim() ||
          athlete.id
      }
    }

    return { blocs: normalizedBlocs, definitions, athletes }
  }
}
