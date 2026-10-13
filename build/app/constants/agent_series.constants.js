import { HEART_RATE_BPM_MAX, HEART_RATE_BPM_MIN, SERIE_TYPE } from '#constants/serie.constants';
export const MAX_SERIES_CHARTS = 30;
export const SERIES_FORCE_ANSWER_AT = 3;
export const CHART_DOWNSAMPLE_POINTS = 96;
export const COMBINED_SERIES_COLORS = [
    '#F87171',
    '#38BDF8',
    '#34D399',
    '#FBBF24',
    '#A78BFA',
    '#F472B6',
    '#2DD4BF',
    '#FB923C',
    '#818CF8',
    '#4ADE80',
    '#E879F9',
    '#22D3EE',
    '#FACC15',
    '#FB7185',
    '#67E8F9',
    '#C084FC',
];
export const CHARTABLE_SERIE_TYPES = [
    SERIE_TYPE.HEART_RATE,
    SERIE_TYPE.SPEED_METERS_PER_SECOND,
    SERIE_TYPE.TOTAL_DISTANCE_IN_METERS,
    SERIE_TYPE.ELEVATION_IN_METERS,
    SERIE_TYPE.POWER_IN_WATTS,
];
export const SERIES_CHART_ALIASES = {
    [SERIE_TYPE.HEART_RATE]: [
        'HEART_RATE',
        'heart rate',
        'heartrate',
        'heart-rate',
        'cardiac frequency',
        'pulse',
        'pulse rate',
        'fc',
        'hr',
        'bpm',
        'fréquence cardiaque',
        'frequence cardiaque',
    ],
    [SERIE_TYPE.SPEED_METERS_PER_SECOND]: [
        'SPEED_METERS_PER_SECOND',
        'speed',
        'velocity',
        'pace',
        'running speed',
        'vitesse',
    ],
    [SERIE_TYPE.TOTAL_DISTANCE_IN_METERS]: [
        'TOTAL_DISTANCE_IN_METERS',
        'distance',
        'total distance',
        'distance covered',
        'distance run',
        'mileage',
    ],
    [SERIE_TYPE.ELEVATION_IN_METERS]: [
        'ELEVATION_IN_METERS',
        'elevation',
        'elevation gain',
        'altitude',
        'ascent',
        'climb',
        'vertical gain',
        'élévation',
        'dénivelé',
        'denivele',
    ],
    [SERIE_TYPE.POWER_IN_WATTS]: [
        'POWER_IN_WATTS',
        'power',
        'watt',
        'watts',
        'power output',
        'cycling power',
        'puissance',
    ],
};
export const SERIES_CURVE_INTENT = /\b(courbes?|curves?|graphs?|graphiques?|charts?|plots?|s[eé]ries?(?:\s+temporelles?)?|time\s*series|timeserie|intra[-\s]?s[eé]ance|pendant\s+(la\s+|l[''])?(s[eé]ance|activit[eé]|match)|au\s+cours\s+de\s+(la\s+|l[''])?(s[eé]ance|activit[eé])|capteurs?|sensors?|data_encoded)\b/i;
export const SERIES_BAND_ZONE_EXCLUDE = /\b(bandes?|zones?|speed\s*bands?|velocity\s*bands?|heart\s*rate\s*bands?|hr\s*zones?)\b/i;
export const SERIES_INTRA_SESSION_MARKERS = /\b(courbes?|curves?|s[eé]ries?(?:\s+temporelles?)?|time\s*series|timeserie|intra[-\s]?s[eé]ance|pendant\s+(la\s+|l[''])?(s[eé]ance|activit[eé]|match)|au\s+cours\s+de|capteurs?|sensors?|data_encoded)\b/i;
export const SERIES_DAILY_AGGREGATE_EXCLUDE = /\b(metrics?|m[eé]triques?)\b|\b((?:over|during|for|in|on|since|from|last|past|sur|pendant|depuis|lors)\b.{0,40}\b(\d+\s*)?(days?|jours?|weeks?|semaines?|months?|mois)|(?:\d+\s*)(days?|jours?)\b)/i;
export const CHART_SERIE_META = {
    [SERIE_TYPE.HEART_RATE]: {
        label: 'Heart Rate (bpm)',
        color: '#F87171',
        validate: (v) => v >= HEART_RATE_BPM_MIN && v <= HEART_RATE_BPM_MAX,
    },
    [SERIE_TYPE.POWER_IN_WATTS]: {
        label: 'Power (W)',
        color: '#FBBF24',
        validate: (v) => v >= 0 && v < 5000,
        smooth: true,
    },
    [SERIE_TYPE.ELEVATION_IN_METERS]: { label: 'Elevation (m)', color: '#34D399', decimals: 1 },
    [SERIE_TYPE.SPEED_METERS_PER_SECOND]: {
        label: 'Speed (m/s)',
        color: '#38BDF8',
        decimals: 2,
        validate: (v) => v >= 0,
    },
    [SERIE_TYPE.TOTAL_DISTANCE_IN_METERS]: {
        label: 'Distance (m)',
        color: '#A78BFA',
        decimals: 1,
        validate: (v) => v >= 0,
    },
};
//# sourceMappingURL=agent_series.constants.js.map