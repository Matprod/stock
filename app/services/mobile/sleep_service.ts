import type { SubjectiveScaleFieldResponse } from '#contracts/subjective_scale'
import { SubjectiveScaleValuesService } from '#services/subjective_scale_values_service'
import Sleep from '#models_pg/sleep'
import { DateTime } from 'luxon'
import type { AddSleepPayload } from '#schemas/mobile/sleep'
import AthleteService from '#services/athlete_service'

const BEDTIME_DAY_BOUNDARY_HOUR = 6
const TIME_PART_REGEX = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/

export default class SleepService {
  private athleteService: AthleteService
  private subjectiveScaleValuesService = new SubjectiveScaleValuesService()

  constructor() {
    this.athleteService = new AthleteService()
  }

  public async getSleepData(athleteId: string, dateOfDay: Date): Promise<Sleep | null> {
    return Sleep.query()
      .whereHas('day', (query) => {
        query.where('athleteId', athleteId).where('dateOfDay', dateOfDay)
      })
      .first()
  }

  public async addOrUpdateSleep(
    athleteId: string,
    dateOfDay: Date,
    payload: AddSleepPayload,
    sleepScales: SubjectiveScaleFieldResponse[]
  ): Promise<Sleep> {
    const dateOfDayDt = DateTime.fromJSDate(dateOfDay)
    let bedtimeDate: DateTime | null = null
    let wakeUpDate: DateTime | null = null

    if (payload.bedtime?.trim()) {
      bedtimeDate = this.parseBedtime(dateOfDayDt, payload.bedtime)
    }
    if (payload.wakeUp?.trim()) {
      wakeUpDate = this.parseWakeUp(dateOfDayDt, payload.wakeUp)
    }

    const napAmMs = this.parseDurationToMs(payload.napAM)
    const napPmMs = this.parseDurationToMs(payload.napPM)
    let baseSleepMs = 0
    if (bedtimeDate && wakeUpDate) {
      baseSleepMs = Math.max(0, wakeUpDate.diff(bedtimeDate).toMillis())
    }
    const totalSleepMs = baseSleepMs + napAmMs + napPmMs

    const day = await this.athleteService.getOrCreateDay(athleteId, dateOfDayDt)

    const values = {
      bedtimeDate,
      wakeUpDate,
      totalInBedTimeMilli: totalSleepMs > 0 ? totalSleepMs : null,
      totalAwakeTimeMilli: totalSleepMs > 0 ? 0 : null,
      napAm: napAmMs > 0 ? napAmMs : null,
      napPm: napPmMs > 0 ? napPmMs : null,
    }

    const existing = await Sleep.query().where('dayId', day.id).first()
    let sleep = existing
      ? await existing.merge(values).save()
      : await Sleep.create({
          dayId: day.id,
          dataSource: 'manual',
          ...values,
        })

    if (payload.ratings && Object.keys(payload.ratings).length > 0) {
      await this.subjectiveScaleValuesService.applySleep(sleep, sleepScales, payload.ratings)
    }

    return sleep
  }

  public buildSleepResponse(sleep: Sleep | null, sleepScales: SubjectiveScaleFieldResponse[]) {
    let totalSleepMilli = sleep?.totalInBedTimeMilli ?? null
    if (sleep != null && sleep.dataSource !== 'garmin' && totalSleepMilli) {
      totalSleepMilli = totalSleepMilli - (sleep.totalAwakeTimeMilli ?? 0)
    }

    return {
      id: sleep?.id,
      bedtime: sleep?.bedtimeDate ? sleep.bedtimeDate.toFormat('HH:mm') : null,
      wakeUp: sleep?.wakeUpDate ? sleep.wakeUpDate.toFormat('HH:mm') : null,
      hoursSlept: totalSleepMilli ? DateTime.fromMillis(totalSleepMilli).toFormat('HH:mm') : null,
      ratings: sleep ? this.subjectiveScaleValuesService.readSleep(sleep, sleepScales) : {},
      dataSource: sleep?.dataSource ?? null,
      napAM: sleep?.napAm ? DateTime.fromMillis(sleep.napAm).toFormat('HH:mm') : null,
      napPM: sleep?.napPm ? DateTime.fromMillis(sleep.napPm).toFormat('HH:mm') : null,
    }
  }

  private parseTimeParts(value: string): { hour: number; minute: number; second: number } {
    const match = value.trim().match(TIME_PART_REGEX)
    if (!match) {
      throw new Error('Invalid time format. Use HH:mm or HH:mm:ss')
    }
    const hour = parseInt(match[1], 10)
    const minute = parseInt(match[2], 10)
    const second = match[3] !== undefined ? parseInt(match[3], 10) : 0
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
      throw new Error('Invalid time format. Use HH:mm or HH:mm:ss')
    }
    return { hour, minute, second }
  }

  private parseBedtime(dateOfDay: DateTime, bedtime: string): DateTime {
    const { hour, minute, second } = this.parseTimeParts(bedtime)
    const baseDate = hour < BEDTIME_DAY_BOUNDARY_HOUR ? dateOfDay : dateOfDay.minus({ days: 1 })
    return baseDate.set({ hour, minute, second, millisecond: 0 })
  }

  private parseWakeUp(dateOfDay: DateTime, wakeUp: string): DateTime {
    const { hour, minute, second } = this.parseTimeParts(wakeUp)
    return dateOfDay.set({ hour, minute, second, millisecond: 0 })
  }

  private parseDurationToMs(value: string | null | undefined): number {
    if (!value?.trim()) return 0
    const { hour, minute, second } = this.parseTimeParts(value)
    return ((hour * 60 + minute) * 60 + second) * 1000
  }
}
