import { DateTime, FixedOffsetZone } from 'luxon'
import { WHOOP_KJ_TO_KCAL, WHOOP_SPORT_TO_ACTIVITY } from '#constants/whoop.constants'
import type { WhoopWorkout } from '#contracts/whoop'
import ActivityDisplayVariable from '#models_pg/activity_display_variable'
import { isNil } from '#utils/boolean'
import {
  getActivityVariableUnit,
  resolveActivityDisplayVariables,
} from '#utils/get_activity_variable'

export function mapWhoopSport(sportName: string): string | null {
  return WHOOP_SPORT_TO_ACTIVITY[sportName.trim().toLowerCase()] ?? null
}

/**
 * Converts Whoop UTC start/end + `timezone_offset` (+02:00) into local DateTimes
 * and duration — needed to attribute sleep/workout to the correct Day.
 */
export function resolveWhoopLocalRange(startIso: string, endIso: string, offset: string) {
  const match = offset.trim().match(/^([+-])(\d{2}):(\d{2})$/)
  const minutes = match
    ? (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]))
    : 0
  const zone = FixedOffsetZone.instance(minutes)
  const startUtc = DateTime.fromISO(startIso, { zone: 'utc' })
  const endUtc = DateTime.fromISO(endIso, { zone: 'utc' })
  return {
    startLocal: startUtc.setZone(zone),
    endLocal: endUtc.setZone(zone),
    durationSeconds: Math.max(0, Math.round(endUtc.diff(startUtc, 'seconds').seconds)),
  }
}

export async function buildWhoopWorkoutMetrics(
  workout: WhoopWorkout,
  activityId: string,
  clubId: string | null,
  durationSeconds: number
) {
  const raw = await ActivityDisplayVariable.query()
    .where('activityId', activityId)
    .where((query) => {
      query.whereNull('clubId')
      if (clubId) query.orWhere('clubId', clubId)
    })
    .preload('displayVariable')

  const dvs = resolveActivityDisplayVariables(raw, clubId)
  const distanceUnit = getActivityVariableUnit(dvs, 'distance')
  const elevationUnit = getActivityVariableUnit(dvs, 'elevation')
  const bpmUnit = getActivityVariableUnit(dvs, 'bpm')
  const fcMaxUnit = getActivityVariableUnit(dvs, 'fcMax')
  const caloriesUnit = getActivityVariableUnit(dvs, 'calories')
  const score = workout.score
  const clean = (v: number | null | undefined) =>
    isNil(v) || !Number.isFinite(v) || v === 0 ? null : v

  return {
    durationSeconds: dvs.some((dv) => dv.displayVariable.name === 'duration')
      ? durationSeconds
      : null,
    distance:
      score?.distance_meter != null && distanceUnit
        ? clean(
            distanceUnit === 'km'
              ? Math.round((score.distance_meter / 1000) * 100) / 100
              : score.distance_meter
          )
        : null,
    elevation:
      score?.altitude_gain_meter != null && elevationUnit
        ? clean(Math.round(score.altitude_gain_meter))
        : null,
    averagedBpm:
      score?.average_heart_rate != null && bpmUnit ? clean(score.average_heart_rate) : null,
    fcMax: score?.max_heart_rate != null && fcMaxUnit ? clean(score.max_heart_rate) : null,
    activeCalories:
      score?.kilojoule != null && caloriesUnit
        ? clean(Math.round(score.kilojoule / WHOOP_KJ_TO_KCAL))
        : null,
  }
}
