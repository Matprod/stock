import { SubjectiveScaleValuesService } from '#services/subjective_scale_values_service';
import Sleep from '#models_pg/sleep';
import { DateTime } from 'luxon';
import AthleteService from '#services/athlete_service';
const BEDTIME_DAY_BOUNDARY_HOUR = 6;
const TIME_PART_REGEX = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
export default class SleepService {
    athleteService;
    subjectiveScaleValuesService = new SubjectiveScaleValuesService();
    constructor() {
        this.athleteService = new AthleteService();
    }
    async getSleepData(athleteId, dateOfDay) {
        return Sleep.query()
            .whereHas('day', (query) => {
            query.where('athleteId', athleteId).where('dateOfDay', dateOfDay);
        })
            .first();
    }
    async addOrUpdateSleep(athleteId, dateOfDay, payload, sleepScales) {
        const dateOfDayDt = DateTime.fromJSDate(dateOfDay);
        let bedtimeDate = null;
        let wakeUpDate = null;
        if (payload.bedtime?.trim()) {
            bedtimeDate = this.parseBedtime(dateOfDayDt, payload.bedtime);
        }
        if (payload.wakeUp?.trim()) {
            wakeUpDate = this.parseWakeUp(dateOfDayDt, payload.wakeUp);
        }
        const napAmMs = this.parseDurationToMs(payload.napAM);
        const napPmMs = this.parseDurationToMs(payload.napPM);
        let baseSleepMs = 0;
        if (bedtimeDate && wakeUpDate) {
            baseSleepMs = Math.max(0, wakeUpDate.diff(bedtimeDate).toMillis());
        }
        const totalSleepMs = baseSleepMs + napAmMs + napPmMs;
        const day = await this.athleteService.getOrCreateDay(athleteId, dateOfDayDt);
        const values = {
            bedtimeDate,
            wakeUpDate,
            totalInBedTimeMilli: totalSleepMs > 0 ? totalSleepMs : null,
            totalAwakeTimeMilli: totalSleepMs > 0 ? 0 : null,
            napAm: napAmMs > 0 ? napAmMs : null,
            napPm: napPmMs > 0 ? napPmMs : null,
        };
        const existing = await Sleep.query().where('dayId', day.id).first();
        let sleep = existing
            ? await existing.merge(values).save()
            : await Sleep.create({
                dayId: day.id,
                dataSource: 'manual',
                ...values,
            });
        if (payload.ratings && Object.keys(payload.ratings).length > 0) {
            await this.subjectiveScaleValuesService.applySleep(sleep, sleepScales, payload.ratings);
        }
        return sleep;
    }
    buildSleepResponse(sleep, sleepScales) {
        let totalSleepMilli = sleep?.totalInBedTimeMilli ?? null;
        if (sleep != null && sleep.dataSource !== 'garmin' && totalSleepMilli) {
            totalSleepMilli = totalSleepMilli - (sleep.totalAwakeTimeMilli ?? 0);
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
        };
    }
    parseTimeParts(value) {
        const match = value.trim().match(TIME_PART_REGEX);
        if (!match) {
            throw new Error('Invalid time format. Use HH:mm or HH:mm:ss');
        }
        const hour = parseInt(match[1], 10);
        const minute = parseInt(match[2], 10);
        const second = match[3] !== undefined ? parseInt(match[3], 10) : 0;
        if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
            throw new Error('Invalid time format. Use HH:mm or HH:mm:ss');
        }
        return { hour, minute, second };
    }
    parseBedtime(dateOfDay, bedtime) {
        const { hour, minute, second } = this.parseTimeParts(bedtime);
        const baseDate = hour < BEDTIME_DAY_BOUNDARY_HOUR ? dateOfDay : dateOfDay.minus({ days: 1 });
        return baseDate.set({ hour, minute, second, millisecond: 0 });
    }
    parseWakeUp(dateOfDay, wakeUp) {
        const { hour, minute, second } = this.parseTimeParts(wakeUp);
        return dateOfDay.set({ hour, minute, second, millisecond: 0 });
    }
    parseDurationToMs(value) {
        if (!value?.trim())
            return 0;
        const { hour, minute, second } = this.parseTimeParts(value);
        return ((hour * 60 + minute) * 60 + second) * 1000;
    }
}
//# sourceMappingURL=sleep_service.js.map