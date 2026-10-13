export const KCAL_PER_G_CHO = 4;
export const KCAL_PER_G_PROT = 4;
export const KCAL_PER_G_FAT = 9;
export const PAL_REST_DAY = 1.35;
export const PAL_TRAINING_DAY = 1.3;
export const BMR_MEASURED_MAX_AGE_MONTHS = 12;
export const EA_FLOOR_KCAL_PER_FFM = 30;
export const FFM_ESTIMATE_RATIO_FEMALE = 0.78;
export const MET_NET_FACTOR = 1.05;
export const POWER_TO_KCAL_FACTOR = 3.6;
export const CUNNINGHAM_BMR_INTERCEPT = 500;
export const CUNNINGHAM_BMR_FFM_COEFFICIENT = 22;
export const BMR_FALLBACK_HEIGHT_CM = 170;
export const BMR_FALLBACK_AGE_YEARS = 30;
export const MIFFLIN_WEIGHT_COEFFICIENT = 10;
export const MIFFLIN_HEIGHT_COEFFICIENT = 6.25;
export const MIFFLIN_AGE_COEFFICIENT = 5;
export const MIFFLIN_MALE_INTERCEPT = 5;
export const MIFFLIN_FEMALE_INTERCEPT = -161;
export const DEFAULT_MET = 5;
export const CYCLING_COMPETITION_MET = 10;
export const MILITARY_MET = 6;
export const RPE_MET_THRESHOLDS = [
    { minRpe: 8, met: 12 },
    { minRpe: 6, met: 10 },
    { minRpe: 4, met: 8 },
    { minRpe: 3, met: 6 },
];
export const CYCLING_ACTIVITY_NAMES = ['Cycle', 'VTT', 'Cycle (electric)'];
export const STRENGTH_ACTIVITY_NAMES = ['Musculation', 'Reinforcement'];
export const MET_BY_ACTIVITY_NAME = {
    'Run': 9,
    'Trail Run': 9,
    'Cycle': 7,
    'VTT': 7,
    'Cycle (electric)': 7,
    'Triathlon': 8,
    'Football': 7,
    'Rugby': 7,
    'Basketball': 6.5,
    'Musculation': 4,
    'Reinforcement': 4,
};
export const PROTEIN_G_PER_KG_MIN = 1.6;
export const PROTEIN_G_PER_KG_MAX = 2.0;
export const PROTEIN_STRENGTH_BONUS_G_PER_KG = 0.2;
export const PROTEIN_STRENGTH_CAP_G_PER_KG = 2.2;
export const LIPID_FLOOR_G_PER_KG = 1.0;
export const LIPID_COMPETITION_TOLERANCE_G_PER_KG = 0.8;
export const LIPID_CEILING_G_PER_KG = 1.5;
export const LIPID_CEILING_HIGH_CHO_DAY_G_PER_KG = 1.0;
export const HIGH_CHO_DAY_TYPES = ['lourd', 'competition'];
export const COMPETITION_TOMORROW_CHO_MIN_G_PER_KG = 8;
export const COMPETITION_TOMORROW_CHO_MAX_G_PER_KG = 10;
export const CHO_G_PER_KG_BY_DAY_TYPE = {
    repos: [3.5, 4.5],
    leger: [4, 6],
    endurance: [6, 8],
    lourd: [8, 11],
    competition: [8, 11],
};
export const DAY_LOAD_THRESHOLDS = {
    reposMax: 300,
    legerMax: 800,
    enduranceMax: 1500,
};
export const CALENDAR_HEAVY_SESSION_MINUTES = 150;
export const CALENDAR_ENDURANCE_SESSION_MINUTES = 60;
export const CYCLING_ACTIVITY_NAME_SET = new Set(CYCLING_ACTIVITY_NAMES);
export const STRENGTH_ACTIVITY_NAME_SET = new Set(STRENGTH_ACTIVITY_NAMES);
export const HIGH_CHO_DAY_TYPE_SET = new Set(HIGH_CHO_DAY_TYPES);
//# sourceMappingURL=nutrition_energy.constants.js.map