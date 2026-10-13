import { FLOAT_PRECISION_SERIE_TYPES, SERIE_TYPE, type SerieType } from '#constants/serie.constants'
import type { GarminActivitySample } from '#contracts/garmin'
import Period from '#models_pg/period'
import { isNil } from './boolean.js'
import { decodeJsonPayload, encodeJsonPayload } from './statistics.js'

export type ActivitySeriesEncoded = {
  heartRateSeriesEncoded: string[]
  powerSeriesEncoded: string[]
  elevationSeriesEncoded: string[]
  speedSeriesEncoded: string[]
  latitudeSeriesEncoded: string[]
  longitudeSeriesEncoded: string[]
}

export type SerieEntry = {
  type: string
  timestamps: number[]
  values: number[]
}

const POWER_HR_ALIGN_SEC = 2
const POWER_HR_MIN_POINTS = 30

const buildPowerHrRatioEntry = (entries: SerieEntry[]): SerieEntry | null => {
  const hrEntry = entries.find((e) => e.type === SERIE_TYPE.HEART_RATE)
  const powerEntry = entries.find((e) => e.type === SERIE_TYPE.POWER_IN_WATTS)
  if (!hrEntry || !powerEntry) return null

  const hrByTs = new Map<number, number>()
  for (let i = 0; i < hrEntry.timestamps.length; i++) {
    hrByTs.set(hrEntry.timestamps[i], hrEntry.values[i])
  }

  const timestamps: number[] = []
  const values: number[] = []

  for (let i = 0; i < powerEntry.timestamps.length; i++) {
    const ts = powerEntry.timestamps[i]
    const power = powerEntry.values[i]
    if (power <= 0) continue

    let hr: number | undefined
    for (let delta = 0; delta <= POWER_HR_ALIGN_SEC; delta++) {
      hr = hrByTs.get(ts + delta) ?? hrByTs.get(ts - delta)
      if (hr != null && hr > 0) break
    }
    if (hr == null || hr <= 0) continue

    timestamps.push(ts)
    values.push(Math.round((power / hr) * 100) / 100)
  }

  if (timestamps.length < POWER_HR_MIN_POINTS) return null

  return { type: 'POWER_HR_RATIO', timestamps, values }
}

const ACTIVITY_SERIES_BY_TYPE: Partial<Record<SerieType, keyof ActivitySeriesEncoded>> = {
  [SERIE_TYPE.HEART_RATE]: 'heartRateSeriesEncoded',
  [SERIE_TYPE.POWER_IN_WATTS]: 'powerSeriesEncoded',
  [SERIE_TYPE.ELEVATION_IN_METERS]: 'elevationSeriesEncoded',
  [SERIE_TYPE.SPEED_METERS_PER_SECOND]: 'speedSeriesEncoded',
  [SERIE_TYPE.LATITUDE]: 'latitudeSeriesEncoded',
  [SERIE_TYPE.LONGITUDE]: 'longitudeSeriesEncoded',
}

const emptyActivitySeriesEncoded = (): ActivitySeriesEncoded => ({
  heartRateSeriesEncoded: [],
  powerSeriesEncoded: [],
  elevationSeriesEncoded: [],
  speedSeriesEncoded: [],
  latitudeSeriesEncoded: [],
  longitudeSeriesEncoded: [],
})

export const fetchSeriesEncodedByActivityIds = async (
  activityIds: string[],
  serieType: SerieType = SERIE_TYPE.HEART_RATE
): Promise<Map<string, string[]>> => {
  if (!activityIds.length) return new Map()

  const periods = await Period.query()
    .whereIn('sportActivityId', activityIds)
    .orderBy('startTime', 'asc')
    .preload('series', (q) => q.where('type', serieType).orderBy('id', 'asc'))

  return periods.reduce((map, period) => {
    const encoded = (period.series ?? []).map((s) => s.dataEncoded).filter(Boolean)
    if (!encoded.length) return map
    const list = map.get(period.sportActivityId) ?? []
    list.push(...encoded)
    return map.set(period.sportActivityId, list)
  }, new Map<string, string[]>())
}

export const fetchActivitySeriesEncodedByActivityIds = async (
  activityIds: string[]
): Promise<Map<string, ActivitySeriesEncoded>> => {
  if (!activityIds.length) return new Map()

  const serieTypes = Object.keys(ACTIVITY_SERIES_BY_TYPE)
  const periods = await Period.query()
    .whereIn('sportActivityId', activityIds)
    .orderBy('startTime', 'asc')
    .preload('series', (q) => q.whereIn('type', serieTypes).orderBy('id', 'asc'))

  return periods.reduce((map, period) => {
    const entry = map.get(period.sportActivityId) ?? emptyActivitySeriesEncoded()

    for (const serie of period.series ?? []) {
      const field = ACTIVITY_SERIES_BY_TYPE[serie.type]
      if (field && serie.dataEncoded) entry[field].push(serie.dataEncoded)
    }

    return map.set(period.sportActivityId, entry)
  }, new Map<string, ActivitySeriesEncoded>())
}

export const fetchActivitySeriesDecodedByActivityIds = async (
  activityIds: string[]
): Promise<Map<string, SerieEntry[]>> => {
  if (!activityIds.length) return new Map()

  const serieTypes = Object.keys(ACTIVITY_SERIES_BY_TYPE)
  const periods = await Period.query()
    .whereIn('sportActivityId', activityIds)
    .orderBy('startTime', 'asc')
    .preload('series', (q) => q.whereIn('type', serieTypes).orderBy('id', 'asc'))

  const rawByActivity = new Map<string, Map<SerieType, Array<{ ts: number; value: number }>>>()

  for (const period of periods) {
    const activityId = period.sportActivityId
    if (!rawByActivity.has(activityId)) rawByActivity.set(activityId, new Map())
    const byType = rawByActivity.get(activityId)!

    for (const serie of period.series ?? []) {
      if (!serie.dataEncoded) continue
      const type = serie.type as SerieType
      const points = decodeSeriePoints(serie.dataEncoded, type)
      const existing = byType.get(type) ?? []
      existing.push(...points)
      byType.set(type, existing)
    }
  }

  return new Map(
    [...rawByActivity.entries()].map(([activityId, byType]) => {
      const entries: SerieEntry[] = []
      for (const [type, rawPoints] of byType.entries()) {
        const sorted = rawPoints.sort((a, b) => a.ts - b.ts)
        if (!sorted.length) continue
        const t0 = sorted[0].ts
        entries.push({
          type,
          timestamps: sorted.map((p) => Math.max(0, p.ts - t0)),
          values: sorted.map((p) => p.value),
        })
      }

      const ratioEntry = buildPowerHrRatioEntry(entries)
      if (ratioEntry) entries.push(ratioEntry)

      return [activityId, entries]
    })
  )
}

export const getValueKeyBySerieType = (type: SerieType): string => {
  switch (type) {
    case SERIE_TYPE.HEART_RATE:
      return 'hr'
    case SERIE_TYPE.SPEED_METERS_PER_SECOND:
      return 'speed'
    case SERIE_TYPE.ELEVATION_IN_METERS:
      return 'elevation'
    case SERIE_TYPE.AIR_TEMPERATURE_CELSIUS:
      return 'temperature'
    case SERIE_TYPE.STEPS_PER_MINUTE:
      return 'steps'
    case SERIE_TYPE.TOTAL_DISTANCE_IN_METERS:
      return 'distance'
    case SERIE_TYPE.POWER_IN_WATTS:
      return 'power'
    case SERIE_TYPE.BIKE_CADENCE_IN_RPM:
      return 'bikeCadence'
    case SERIE_TYPE.SWIM_CADENCE_IN_STROKES_PER_MINUTE:
      return 'swimCadence'
    case SERIE_TYPE.WHEEL_CHAIR_CADENCE_IN_PUSHES_PER_MINUTE:
      return 'wheelChairCadence'
    case SERIE_TYPE.LATITUDE:
      return 'latitude'
    case SERIE_TYPE.LONGITUDE:
      return 'longitude'
    default:
      return 'value'
  }
}

export const parsedPointSeries = <TPoint extends Record<string, unknown>, TKey extends string>(
  points: TPoint[],
  valueKey: TKey,
  options?: { roundValues?: boolean }
): Array<{ ts: number; value: number }> => {
  const roundValues = options?.roundValues ?? true

  return points
    .filter((point) => {
      const ts = Number(point.ts)
      const value = Number(point[valueKey])

      return Number.isFinite(ts) && Number.isFinite(value)
    })
    .map((point) => ({
      ts: Math.round(Number(point.ts)),
      value: roundValues ? Math.round(Number(point[valueKey])) : Number(point[valueKey]),
    }))
    .sort((a, b) => a.ts - b.ts)
}

export const buildTimestampValuePairs = (
  samples: GarminActivitySample[],
  valueSelector: (sample: GarminActivitySample) => number | undefined
): number[] => {
  return samples.flatMap((sample) => {
    const value = valueSelector(sample)
    const timestamp = sample.startTimeInSeconds
    if (isNil(value) || !Number.isFinite(value) || !Number.isFinite(timestamp)) {
      return []
    }

    return [timestamp, value]
  })
}

export const buildGarminTimestampSeries = (samples: GarminActivitySample[]) => {
  return {
    elevationInMetersData: buildTimestampValuePairs(samples, (sample) => sample.elevationInMeters),
    airTemperatureCelciusData: buildTimestampValuePairs(
      samples,
      (sample) => sample.airTemperatureCelcius
    ),
    heartRateData: buildTimestampValuePairs(samples, (sample) => sample.heartRate),
    speedMetersPerSecondData: buildTimestampValuePairs(
      samples,
      (sample) => sample.speedMetersPerSecond
    ),
    stepsPerMinuteData: buildTimestampValuePairs(samples, (sample) => sample.stepsPerMinute),
    totalDistanceInMetersData: buildTimestampValuePairs(
      samples,
      (sample) => sample.totalDistanceInMeters
    ),
    powerInWattsData: buildTimestampValuePairs(samples, (sample) => sample.powerInWatts),
    bikeCadenceInRPMData: buildTimestampValuePairs(samples, (sample) => sample.bikeCadenceInRPM),
    swimCadenceInStrokesPerMinuteData: buildTimestampValuePairs(
      samples,
      (sample) => sample.swimCadenceInStrokesPerMinute
    ),
    wheelChairCadenceInPushesPerMinuteData: buildTimestampValuePairs(
      samples,
      (sample) => sample.wheelChairCadenceInPushesPerMinute
    ),
  }
}

export const encodeFlatTimestampPairs = (flatData: number[], type: SerieType): string => {
  const valueKey = getValueKeyBySerieType(type)
  const roundValues = !FLOAT_PRECISION_SERIE_TYPES.has(type)
  const rawPoints = Array.from({ length: Math.floor(flatData.length / 2) }, (_, i) => ({
    ts: flatData[i * 2],
    [valueKey]: flatData[i * 2 + 1],
  }))
  const points = parsedPointSeries(rawPoints, valueKey, { roundValues }).map((point) => ({
    ts: point.ts,
    [valueKey]: point.value,
  }))

  return encodeJsonPayload({ points })
}

export const decodeSerieValues = (dataEncoded: string, type: SerieType): number[] => {
  return decodeSeriePoints(dataEncoded, type).map((point) => point.value)
}

export type DecodedSeriePoint = { ts: number; value: number }

export const decodeSeriePoints = (dataEncoded: string, type: SerieType): DecodedSeriePoint[] => {
  const valueKey = getValueKeyBySerieType(type)
  const payload = decodeJsonPayload<{ points: Array<Record<string, number>> }>(dataEncoded)

  return parsedPointSeries(payload.points ?? [], valueKey, {
    roundValues: !FLOAT_PRECISION_SERIE_TYPES.has(type),
  })
}

export const downsampleSeriePoints = <T>(points: T[], maxPoints: number): T[] => {
  if (maxPoints < 2 || points.length <= maxPoints) return points

  const result: T[] = []
  const step = (points.length - 1) / (maxPoints - 1)
  for (let i = 0; i < maxPoints; i++) {
    result.push(points[Math.round(i * step)])
  }
  return result
}
