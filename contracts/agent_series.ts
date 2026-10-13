import type { SerieType } from '#constants/serie.constants'

export type SeriesMetadataCompact = {
  _auto_decode: true
  serie_ids: string[]
  sql_type: SerieType | null
  athlete_ids?: string[]
}

export type SeriesCurveSummary = {
  athleteName: string
  serieType: SerieType
  sessionDate: string
  min: number
  max: number
  durationSec: number
}

export type SeriesAutoDecodedResult = {
  auto_decoded: true
  curveCount: number
  chartCount?: number
  layout?: 'separate' | 'combined'
  serieType?: SerieType
  requested?: number
  missing?: number
  partial?: boolean
  series: SeriesCurveSummary[]
  note?: string
}

export type SeriesPoint = {
  ts: number
  value: number
}

export type SeriesCurve = {
  athleteName: string
  sessionDate: string
  type: SerieType
  points: SeriesPoint[]
  min: number
  max: number
  durationSec: number
}
