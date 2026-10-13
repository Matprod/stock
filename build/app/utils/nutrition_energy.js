import { DateTime } from 'luxon';
import { GENDER } from '#constants/athlete.constants';
import { EVENT_CATEGORY } from '#constants/event.constants';
import { BMR_FALLBACK_AGE_YEARS, BMR_FALLBACK_HEIGHT_CM, BMR_MEASURED_MAX_AGE_MONTHS, CALENDAR_ENDURANCE_SESSION_MINUTES, CUNNINGHAM_BMR_FFM_COEFFICIENT, CUNNINGHAM_BMR_INTERCEPT, CALENDAR_HEAVY_SESSION_MINUTES, CHO_G_PER_KG_BY_DAY_TYPE, COMPETITION_TOMORROW_CHO_MAX_G_PER_KG, COMPETITION_TOMORROW_CHO_MIN_G_PER_KG, CYCLING_ACTIVITY_NAME_SET, CYCLING_COMPETITION_MET, DAY_LOAD_THRESHOLDS, DEFAULT_MET, EA_FLOOR_KCAL_PER_FFM, FFM_ESTIMATE_RATIO_FEMALE, HIGH_CHO_DAY_TYPE_SET, KCAL_PER_G_CHO, KCAL_PER_G_FAT, KCAL_PER_G_PROT, LIPID_CEILING_G_PER_KG, LIPID_CEILING_HIGH_CHO_DAY_G_PER_KG, LIPID_COMPETITION_TOLERANCE_G_PER_KG, LIPID_FLOOR_G_PER_KG, MET_BY_ACTIVITY_NAME, MET_NET_FACTOR, MIFFLIN_AGE_COEFFICIENT, MIFFLIN_FEMALE_INTERCEPT, MIFFLIN_HEIGHT_COEFFICIENT, MIFFLIN_MALE_INTERCEPT, MIFFLIN_WEIGHT_COEFFICIENT, MILITARY_MET, PAL_REST_DAY, PAL_TRAINING_DAY, POWER_TO_KCAL_FACTOR, PROTEIN_G_PER_KG_MAX, PROTEIN_G_PER_KG_MIN, PROTEIN_STRENGTH_BONUS_G_PER_KG, PROTEIN_STRENGTH_CAP_G_PER_KG, RPE_MET_THRESHOLDS, STRENGTH_ACTIVITY_NAME_SET, } from '#constants/nutrition_energy.constants';
import { getMilitaryActivityType } from '#utils/military';
export const missingNutritionProfileDataError = (message = 'Missing required nutrition profile data') => Object.assign(new Error(message), { name: 'MissingNutritionProfileDataError' });
export const isCompetitionEvent = (event) => event.eventType?.eventCategory === EVENT_CATEGORY.MATCHES;
export const roundMacro = (value) => Math.round(value * 100) / 100;
export const isStrengthActivity = (activity) => {
    const name = activity.sport?.name;
    return name !== undefined && STRENGTH_ACTIVITY_NAME_SET.has(name);
};
const toDateTime = (value) => value instanceof DateTime ? value : DateTime.fromJSDate(value);
const computeTenHaafBmr = (weightKg, heightCm, age, gender) => {
    const sexFactor = gender === GENDER.MALE ? 1 : -1;
    return 11.936 * weightKg + 5.877 * heightCm - 8.129 * age + 191.027 + 29.279 * sexFactor;
};
const computeMifflinBmrFallback = (weightKg, gender) => {
    const sexIntercept = gender === GENDER.MALE ? MIFFLIN_MALE_INTERCEPT : MIFFLIN_FEMALE_INTERCEPT;
    return (MIFFLIN_WEIGHT_COEFFICIENT * weightKg +
        MIFFLIN_HEIGHT_COEFFICIENT * BMR_FALLBACK_HEIGHT_CM -
        MIFFLIN_AGE_COEFFICIENT * BMR_FALLBACK_AGE_YEARS +
        sexIntercept);
};
const resolveChoGPerKg = (dayType, competitionTomorrow) => {
    const [min, max] = CHO_G_PER_KG_BY_DAY_TYPE[dayType];
    if (!competitionTomorrow)
        return [min, max];
    return [
        Math.max(min, COMPETITION_TOMORROW_CHO_MIN_G_PER_KG),
        Math.max(max, COMPETITION_TOMORROW_CHO_MAX_G_PER_KG),
    ];
};
const resolveProteinRange = (weightKg, hasStrengthSession) => {
    const min = PROTEIN_G_PER_KG_MIN * weightKg;
    const max = PROTEIN_G_PER_KG_MAX * weightKg;
    if (!hasStrengthSession)
        return { min, max };
    const bonus = PROTEIN_STRENGTH_BONUS_G_PER_KG * weightKg;
    return {
        min: min + bonus,
        max: Math.min(PROTEIN_STRENGTH_CAP_G_PER_KG * weightKg, max + bonus),
    };
};
const getLipidRange = (weightKg, tdee, carbs, protein, isHighCho) => {
    const floor = (isHighCho ? LIPID_COMPETITION_TOLERANCE_G_PER_KG : LIPID_FLOOR_G_PER_KG) * weightKg;
    const ceiling = (isHighCho ? LIPID_CEILING_HIGH_CHO_DAY_G_PER_KG : LIPID_CEILING_G_PER_KG) * weightKg;
    const fatFrom = (cho, prot) => (tdee - KCAL_PER_G_CHO * cho - KCAL_PER_G_PROT * prot) / KCAL_PER_G_FAT;
    let min = Math.min(Math.max(floor, fatFrom(carbs.max, protein.max)), ceiling);
    const max = Math.min(Math.max(min, fatFrom(carbs.min, protein.min)), ceiling);
    if (min >= max && floor < ceiling)
        min = floor;
    return { min: Math.max(0, min), max: Math.max(min, max) };
};
export const computeBmr = (athlete, weightKg, ffmKg, referenceDate = DateTime.now()) => {
    const extended = athlete;
    if (extended.bmrMeasuredKcal && extended.bmrMeasuredAt) {
        const measuredAt = toDateTime(extended.bmrMeasuredAt);
        if (referenceDate.diff(measuredAt, 'months').months < BMR_MEASURED_MAX_AGE_MONTHS) {
            return extended.bmrMeasuredKcal;
        }
    }
    if (athlete.heightCm && athlete.birthDate) {
        const age = Math.floor(referenceDate.diff(athlete.birthDate, 'years').years);
        return computeTenHaafBmr(weightKg, athlete.heightCm, age, athlete.gender);
    }
    if (ffmKg !== null) {
        return CUNNINGHAM_BMR_INTERCEPT + CUNNINGHAM_BMR_FFM_COEFFICIENT * ffmKg;
    }
    if (weightKg > 0) {
        return computeMifflinBmrFallback(weightKg, athlete.gender);
    }
    throw missingNutritionProfileDataError('Missing required nutrition profile data: weight, height, birth date, or FFM');
};
export const estimateFfmKg = (athlete, weightKg, bodyFatPct) => {
    const extended = athlete;
    if (extended.ffmKg)
        return { ffmKg: extended.ffmKg, estimated: false };
    if (bodyFatPct !== null) {
        return { ffmKg: weightKg * (1 - bodyFatPct / 100), estimated: false };
    }
    return { ffmKg: weightKg * FFM_ESTIMATE_RATIO_FEMALE, estimated: true };
};
export const estimateMetFromRpe = (rpe) => {
    for (const { minRpe, met } of RPE_MET_THRESHOLDS) {
        if (rpe >= minRpe)
            return met;
    }
    return 4;
};
export const estimateMetFromZones = (zones) => {
    const total = zones.zone1 + zones.zone2 + zones.zone3 + zones.zone4 + zones.zone5;
    if (total <= 0)
        return null;
    const highIntensityRatio = (zones.zone3 + zones.zone4 + zones.zone5) / total;
    if (highIntensityRatio > 0.6)
        return 10;
    if (highIntensityRatio > 0.3)
        return 8;
    return 6;
};
export const getDefaultMetForActivity = (activity, isCompetitionSession) => {
    const name = activity.sport?.name;
    if (!name)
        return DEFAULT_MET;
    if (isCompetitionSession && CYCLING_ACTIVITY_NAME_SET.has(name))
        return CYCLING_COMPETITION_MET;
    if (getMilitaryActivityType(name))
        return MILITARY_MET;
    if (name in MET_BY_ACTIVITY_NAME) {
        return MET_BY_ACTIVITY_NAME[name];
    }
    return DEFAULT_MET;
};
export const computeSessionEee = (activity, weightKg, met) => {
    const extended = activity;
    if (extended.mechanicalKJ)
        return extended.mechanicalKJ;
    if (activity.power && activity.durationSeconds) {
        return activity.power * (activity.durationSeconds / 3600) * POWER_TO_KCAL_FACTOR;
    }
    if (activity.activeCalories)
        return activity.activeCalories;
    return ((activity.durationSeconds ?? 0) / 3600) * (met - 1) * weightKg * MET_NET_FACTOR;
};
export const computeDailyEnergy = (bmr, eee, ffmKg, hasSyncedSessions) => {
    const nep = bmr * (hasSyncedSessions ? PAL_TRAINING_DAY : PAL_REST_DAY);
    const tdee = nep + eee;
    return {
        bmr,
        nep,
        eee,
        tdee,
        kcalTarget: Math.max(tdee, EA_FLOOR_KCAL_PER_FFM * ffmKg + eee),
    };
};
export const classifyDayFromCalendar = (events) => {
    if (events.length === 0)
        return 'repos';
    if (events.some(isCompetitionEvent))
        return 'competition';
    const durations = events
        .filter((event) => event.startTime && event.endTime)
        .map((event) => event.endTime.diff(event.startTime, 'minutes').minutes);
    if (durations.length === 0)
        return 'endurance';
    const maxDurationMin = Math.max(...durations);
    if (maxDurationMin > CALENDAR_HEAVY_SESSION_MINUTES)
        return 'lourd';
    if (maxDurationMin >= CALENDAR_ENDURANCE_SESSION_MINUTES)
        return 'endurance';
    return 'leger';
};
export const classifyDayFromEee = (eee, isCompetitionDay) => {
    if (isCompetitionDay)
        return 'competition';
    if (eee < DAY_LOAD_THRESHOLDS.reposMax)
        return 'repos';
    if (eee < DAY_LOAD_THRESHOLDS.legerMax)
        return 'leger';
    if (eee < DAY_LOAD_THRESHOLDS.enduranceMax)
        return 'endurance';
    return 'lourd';
};
export const buildMacroTargets = (input) => {
    const { weightKg, tdee, dayType, competitionTomorrow, hasStrengthSession, isCompetitionDay } = input;
    const [choMin, choMax] = resolveChoGPerKg(dayType, competitionTomorrow);
    const carbs = { min: choMin * weightKg, max: choMax * weightKg };
    const protein = resolveProteinRange(weightKg, hasStrengthSession);
    const fat = getLipidRange(weightKg, tdee, carbs, protein, competitionTomorrow || isCompetitionDay || HIGH_CHO_DAY_TYPE_SET.has(dayType));
    return { carbs, fat, protein };
};
//# sourceMappingURL=nutrition_energy.js.map