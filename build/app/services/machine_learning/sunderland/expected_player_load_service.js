import axios from 'axios';
import env from '#start/env';
import Period from '#models_pg/period';
import Day from '#models_pg/day';
import { MetricService } from '#services/metric_service';
import { MetricDomain } from '#contracts/metric';
import { median, standardDeviation } from '../../../utils/statistics.js';
export default class ExpectedPlayerLoadService {
    metricService;
    expectedPLBaseUrl = env.get('MACHINE_LEARNING_EXPECTED_PLAYER_LOAD_URL');
    constructor() {
        this.metricService = new MetricService(MetricDomain.PERIOD);
    }
    async calculateExpectedPL(payload) {
        const token = env.get('MACHINE_LEARNING_API_TOKEN');
        try {
            const response = await axios.post(this.expectedPLBaseUrl, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
            });
            return response.data;
        }
        catch (error) {
            console.error('Error calculating expected PL:', error);
            throw error;
        }
    }
    async calculateExpectedPLForPeriods(periods) {
        if (periods.length === 0) {
            return new Map();
        }
        const periodData = [];
        const periodIdMap = new Map();
        for (let i = 0; i < periods.length; i++) {
            const period = periods[i];
            const { gen2_velocity_band1_total_distance, gen2_velocity_band3_total_distance, gen2_velocity_band4_total_distance, gen2_velocity_band5_total_distance, total_distance, total_duration, work_rest_ratio, } = this.metricService.extractNumericMetricsAsObject(period, [
                'gen2_velocity_band1_total_distance',
                'gen2_velocity_band3_total_distance',
                'gen2_velocity_band4_total_distance',
                'gen2_velocity_band5_total_distance',
                'total_distance',
                'total_duration',
                'work_rest_ratio',
            ]);
            if (gen2_velocity_band1_total_distance === null ||
                gen2_velocity_band3_total_distance === null ||
                gen2_velocity_band4_total_distance === null ||
                gen2_velocity_band5_total_distance === null ||
                total_distance === null ||
                total_duration === null ||
                work_rest_ratio === null) {
                console.warn(`Skipping period ${period.id} because it is missing required metrics`);
                continue;
            }
            let username_lastname;
            let date_of_day;
            if (period.sportActivity?.day?.athlete) {
                const athlete = period.sportActivity.day.athlete;
                username_lastname = athlete.name.replace(/\s+/g, ' ').trim();
            }
            if (period.sportActivity?.day?.dateOfDay) {
                date_of_day = period.sportActivity.day.dateOfDay.toFormat('yyyy-MM-dd');
            }
            periodData.push({
                gen2_velocity_band1_total_distance,
                gen2_velocity_band3_total_distance,
                gen2_velocity_band4_total_distance,
                gen2_velocity_band5_total_distance,
                total_distance,
                total_duration,
                work_rest_ratio,
                ...(username_lastname && { username_lastname }),
                ...(date_of_day && { date_of_day }),
            });
            periodIdMap.set(periodData.length - 1, period.id);
        }
        if (periodData.length === 0) {
            return new Map();
        }
        const payload = { data: periodData };
        const response = await this.calculateExpectedPL(payload);
        const result = new Map();
        for (let i = 0; i < response.expected_pl.length; i++) {
            const periodId = periodIdMap.get(i);
            if (periodId !== undefined) {
                result.set(periodId, response.expected_pl[i]);
            }
        }
        return result;
    }
    async calculateDeltaPLForPeriod(period, expectedPL) {
        const { total_player_load: actualPL } = this.metricService.extractNumericMetricsAsObject(period, ['total_player_load']);
        if (actualPL === null) {
            return null;
        }
        const deltaPL = expectedPL - actualPL;
        await this.metricService.updateMetrics(period.id, {
            delta_pl: deltaPL,
        });
        return deltaPL;
    }
    async aggregateDeltaPLForDay(athleteId, dateOfDay) {
        const periods = await Period.query()
            .whereHas('sportActivity', (query) => {
            query.whereHas('day', (query) => {
                query.where('athleteId', athleteId).where('dateOfDay', dateOfDay.toJSDate());
            });
        })
            .preload('metricValues', (query) => {
            query.preload('metric');
        })
            .preload('sportActivity', (query) => {
            query.preload('day', (query) => {
                query.preload('athlete');
            });
        });
        if (periods.length === 0) {
            return null;
        }
        const deltaPLMap = new Map();
        const periodsNeedingCalculation = [];
        for (const period of periods) {
            const { delta_pl: existingDeltaPL } = this.metricService.extractNumericMetricsAsObject(period, ['delta_pl']);
            if (existingDeltaPL !== null) {
                deltaPLMap.set(period.id, existingDeltaPL);
            }
            else {
                periodsNeedingCalculation.push(period);
            }
        }
        if (periodsNeedingCalculation.length > 0) {
            const expectedPLMap = await this.calculateExpectedPLForPeriods(periodsNeedingCalculation);
            await Promise.all(periodsNeedingCalculation.map(async (period) => {
                const expectedPL = expectedPLMap.get(period.id);
                if (expectedPL !== undefined) {
                    const deltaPL = await this.calculateDeltaPLForPeriod(period, expectedPL);
                    deltaPLMap.set(period.id, deltaPL);
                }
            }));
        }
        let totalDeltaPL = 0;
        let hasValidDeltaPL = false;
        for (const deltaPL of deltaPLMap.values()) {
            if (deltaPL !== null) {
                totalDeltaPL += deltaPL;
                hasValidDeltaPL = true;
            }
        }
        return hasValidDeltaPL ? totalDeltaPL : null;
    }
    async calculateRollingStatistics(athleteId, currentDate, windowDays = 56) {
        const startDate = currentDate.minus({ days: windowDays });
        const endDate = currentDate.minus({ days: 1 });
        const days = await Day.query()
            .where('athleteId', athleteId)
            .whereBetween('dateOfDay', [startDate.toJSDate(), endDate.toJSDate()])
            .orderBy('dateOfDay', 'asc');
        if (days.length === 0) {
            return { median: 0, stdDev: 1 };
        }
        const dayDates = days
            .map((day) => day.dateOfDay)
            .filter((date) => date !== null);
        if (dayDates.length === 0) {
            return { median: 0, stdDev: 1 };
        }
        const periods = await Period.query()
            .whereHas('sportActivity', (query) => {
            query.whereHas('day', (query) => {
                query.where('athleteId', athleteId).whereIn('dateOfDay', dayDates.map((date) => date.toJSDate()));
            });
        })
            .preload('metricValues', (query) => {
            query.preload('metric');
        })
            .preload('sportActivity', (query) => {
            query.preload('day', (query) => {
                query.preload('athlete');
            });
        });
        const periodsByDay = new Map();
        for (const period of periods) {
            const dateOfDay = period.sportActivity?.day?.dateOfDay;
            if (dateOfDay) {
                const dateKey = dateOfDay.toFormat('yyyy-MM-dd');
                if (!periodsByDay.has(dateKey)) {
                    periodsByDay.set(dateKey, []);
                }
                periodsByDay.get(dateKey).push(period);
            }
        }
        const periodsNeedingCalculation = [];
        const deltaPLMap = new Map();
        for (const period of periods) {
            const { delta_pl: existingDeltaPL } = this.metricService.extractNumericMetricsAsObject(period, ['delta_pl']);
            if (existingDeltaPL !== undefined) {
                deltaPLMap.set(period.id, existingDeltaPL);
            }
            else {
                periodsNeedingCalculation.push(period);
            }
        }
        if (periodsNeedingCalculation.length > 0) {
            const expectedPLMap = await this.calculateExpectedPLForPeriods(periodsNeedingCalculation);
            await Promise.all(periodsNeedingCalculation.map(async (period) => {
                const expectedPL = expectedPLMap.get(period.id);
                if (expectedPL !== undefined) {
                    const deltaPL = await this.calculateDeltaPLForPeriod(period, expectedPL);
                    deltaPLMap.set(period.id, deltaPL);
                }
            }));
        }
        const dailyDeltaPLValues = [];
        for (const day of days) {
            if (!day.dateOfDay)
                continue;
            const dateKey = day.dateOfDay.toFormat('yyyy-MM-dd');
            const dayPeriods = periodsByDay.get(dateKey) || [];
            if (dayPeriods.length === 0)
                continue;
            let totalDeltaPL = 0;
            let hasValidDeltaPL = false;
            for (const period of dayPeriods) {
                const deltaPL = deltaPLMap.get(period.id);
                if (deltaPL !== null && deltaPL !== undefined) {
                    totalDeltaPL += deltaPL;
                    hasValidDeltaPL = true;
                }
            }
            if (hasValidDeltaPL) {
                dailyDeltaPLValues.push(totalDeltaPL);
            }
        }
        if (dailyDeltaPLValues.length === 0) {
            return { median: 0, stdDev: 1 };
        }
        const rollingMedian = median(dailyDeltaPLValues);
        const rollingStdDev = standardDeviation(dailyDeltaPLValues);
        return { median: rollingMedian, stdDev: rollingStdDev || 1 };
    }
    calculateLEI(dailyDeltaPL, rollingMedian, rollingStdDev) {
        if (rollingStdDev === 0) {
            return 0;
        }
        return (dailyDeltaPL - rollingMedian) / rollingStdDev;
    }
    leiToPerformanceScore(lei, k = 0.9) {
        return 100 / (1 + Math.exp(-k * lei));
    }
    async calculatePerformanceScoreForDay(athleteId, dateOfDay) {
        const dailyDeltaPL = await this.aggregateDeltaPLForDay(athleteId, dateOfDay);
        if (dailyDeltaPL === null) {
            return null;
        }
        const { median: rollingMedian, stdDev: rollingStdDev } = await this.calculateRollingStatistics(athleteId, dateOfDay, 56);
        const lei = this.calculateLEI(dailyDeltaPL, rollingMedian, rollingStdDev);
        const performanceScore = Math.round(this.leiToPerformanceScore(lei, 0.9));
        const day = await Day.query()
            .where('athleteId', athleteId)
            .where('dateOfDay', dateOfDay.toJSDate())
            .first();
        if (day) {
            day.performanceScore = performanceScore;
            await day.save();
        }
        return performanceScore;
    }
    async calculateSeasonStatistics(athleteId, seasonStartDate, seasonEndDate) {
        const days = await Day.query()
            .where('athleteId', athleteId)
            .whereBetween('dateOfDay', [seasonStartDate.toJSDate(), seasonEndDate.toJSDate()])
            .orderBy('dateOfDay', 'asc');
        if (days.length === 0) {
            return { median: 0, stdDev: 1 };
        }
        const dayDates = days
            .map((day) => day.dateOfDay)
            .filter((date) => date !== null);
        if (dayDates.length === 0) {
            return { median: 0, stdDev: 1 };
        }
        const periods = await Period.query()
            .whereHas('sportActivity', (query) => {
            query.whereHas('day', (query) => {
                query.where('athleteId', athleteId).whereIn('dateOfDay', dayDates.map((date) => date.toJSDate()));
            });
        })
            .preload('metricValues', (query) => {
            query.preload('metric');
        })
            .preload('sportActivity', (query) => {
            query.preload('day', (query) => {
                query.preload('athlete');
            });
        });
        const periodsByDay = new Map();
        for (const period of periods) {
            const dateOfDay = period.sportActivity?.day?.dateOfDay;
            if (dateOfDay) {
                const dateKey = dateOfDay.toFormat('yyyy-MM-dd');
                if (!periodsByDay.has(dateKey)) {
                    periodsByDay.set(dateKey, []);
                }
                periodsByDay.get(dateKey).push(period);
            }
        }
        const deltaPLMap = new Map();
        for (const period of periods) {
            const { delta_pl: existingDeltaPL } = this.metricService.extractNumericMetricsAsObject(period, ['delta_pl']);
            if (existingDeltaPL !== null && existingDeltaPL !== undefined) {
                deltaPLMap.set(period.id, existingDeltaPL);
            }
        }
        const dailyDeltaPLValues = [];
        for (const day of days) {
            if (!day.dateOfDay)
                continue;
            const dateKey = day.dateOfDay.toFormat('yyyy-MM-dd');
            const dayPeriods = periodsByDay.get(dateKey) || [];
            if (dayPeriods.length === 0)
                continue;
            let totalDeltaPL = 0;
            let hasValidDeltaPL = false;
            for (const period of dayPeriods) {
                const deltaPL = deltaPLMap.get(period.id);
                if (deltaPL !== null && deltaPL !== undefined) {
                    totalDeltaPL += deltaPL;
                    hasValidDeltaPL = true;
                }
            }
            if (hasValidDeltaPL) {
                dailyDeltaPLValues.push(totalDeltaPL);
            }
        }
        if (dailyDeltaPLValues.length === 0) {
            return { median: 0, stdDev: 1 };
        }
        const seasonMedian = median(dailyDeltaPLValues);
        const seasonStdDev = standardDeviation(dailyDeltaPLValues);
        return { median: seasonMedian, stdDev: seasonStdDev || 1 };
    }
}
//# sourceMappingURL=expected_player_load_service.js.map