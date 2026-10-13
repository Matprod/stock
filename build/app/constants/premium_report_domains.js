export const PREMIUM_DOMAIN = {
    LOAD: 'load',
    GPS: 'gps',
    MATCH: 'match',
    WELLNESS: 'wellness',
    SLEEP: 'sleep',
    VALD: 'vald',
    BIOMARKERS: 'biomarkers',
    BODY: 'body',
};
export const PREMIUM_DOMAINS = Object.values(PREMIUM_DOMAIN);
const LOAD_FORMULAS = [
    'mean',
    'sum',
    'ewma',
    'ma',
    'median_ma',
    'cumulative',
    'monotony',
    'strain',
    'acwr_ewma',
    'acwr_ma',
];
const STATS_FORMULAS = ['mean', 'sum', 'max', 'median', 'median_ma', 'ma'];
const WELLNESS_FORMULAS = [
    'zscore',
    'mean',
    'median',
    'sd',
    'cv',
    'p25',
    'p75',
    'p90',
    'p95',
    'delta_pct',
];
const CAPACITY_FORMULAS = [
    'delta_pct',
    'pct_baseline',
    'zscore',
    'mean',
    'median',
    'max',
    'min',
];
export const PREMIUM_DOMAIN_CATALOG = {
    [PREMIUM_DOMAIN.LOAD]: {
        keywords: [
            'load',
            'training load',
            'player load',
            'srpe',
            's-rpe',
            'rpe',
            'monotony',
            'strain',
            'acwr',
            'ewma',
            'foster',
            'acute',
            'chronic',
        ],
        jev: {
            question: 'Does `prompt` ask about training load, perceived effort, sRPE, monotony, strain, ACWR, EWMA load trends, or Foster?',
            trueLabel: 'Load / Foster / ACWR',
            falseLabel: 'No load analysis requested',
        },
        schemaTitles: [
            'Athlete Identity',
            'Daily Scores',
            'Health & Wellness',
            'Sport Activities & Training',
        ],
        formulaIds: LOAD_FORMULAS,
        macros: [
            {
                name: 'fetch_srpe_daily',
                templateId: 'daily_srpe',
                description: 'Daily sRPE per athlete',
            },
        ],
        loadSummary: true,
        correlation: true,
    },
    [PREMIUM_DOMAIN.GPS]: {
        keywords: [
            'gps',
            'distance',
            'vmax',
            'speed',
            'velocity',
            'density',
            'm/min',
            'sprint',
            'high-speed',
            'hsr',
            'hmld',
            'acceler',
            'deceler',
            'change of direction',
            'cod',
            'overexposure',
            'training',
            'session',
        ],
        jev: {
            question: 'Does `prompt` ask about GPS training data, distance, running volume, intensity, high speed, HSR, Vmax, accelerations, decelerations, change of direction (COD), or density (m/min) — not match/competition stats?',
            trueLabel: 'GPS / distance / accel-decel / COD',
            falseLabel: 'No GPS training analysis requested',
        },
        schemaTitles: [
            'Athlete Identity',
            'Sport Activities & Training',
            'Activity Reference & Zones',
        ],
        formulaIds: STATS_FORMULAS,
        macros: [
            {
                name: 'fetch_gps_distance',
                templateId: 'gps_distance',
                description: 'GPS distance + minutes per athlete',
            },
            {
                name: 'fetch_gps_intensity',
                templateId: 'gps_intensity',
                description: 'GPS intensity KPIs per athlete (accel/decel/COD included)',
            },
            {
                name: 'fetch_gps_intensity_daily',
                templateId: 'gps_intensity_daily',
                description: 'Per training day × athlete GPS intensity incl. player_load (StatSports dsl/kpi_dsl). Chart player_load for load evolution — do not free-SQL hunt pm.name',
            },
        ],
        correlation: true,
    },
    [PREMIUM_DOMAIN.MATCH]: {
        keywords: [
            'match',
            'matches',
            'competition',
            'minutes',
            'tackles',
            'game',
            'fixture',
        ],
        jev: {
            question: 'Does `prompt` ask about match/competition physical stats, minutes played, tackles, or game-day GPS — not routine training sessions?',
            trueLabel: 'Match / competition / minutes',
            falseLabel: 'No match analysis requested',
        },
        schemaTitles: [
            'Athlete Identity',
            'Sport Activities & Training',
            'Activity Reference & Zones',
        ],
        formulaIds: STATS_FORMULAS,
        macros: [
            {
                name: 'fetch_match_stats',
                templateId: 'match_stats',
                description: 'Match/competition stats (prefer over free SQL)',
            },
        ],
        correlation: true,
    },
    [PREMIUM_DOMAIN.WELLNESS]: {
        keywords: [
            'wellness',
            'recovery',
            'soreness',
            'mood',
            'stress',
            'energy',
            'z-score',
            'zscore',
        ],
        jev: {
            question: 'Does `prompt` ask about wellness ratings, soreness, mood, stress, energy, recovery feeling, or wellness z-scores — not sleep duration/quality specifically?',
            trueLabel: 'Wellness / soreness / mood / stress',
            falseLabel: 'No wellness analysis requested',
        },
        schemaTitles: ['Athlete Identity', 'Daily Scores', 'Health & Wellness'],
        formulaIds: WELLNESS_FORMULAS,
        macros: [],
        correlation: true,
    },
    [PREMIUM_DOMAIN.SLEEP]: {
        keywords: ['sleep', 'night', 'nights', 'insomnia'],
        jev: {
            question: 'Does `prompt` ask about sleep duration, sleep quality, nights, or recovery via sleep?',
            trueLabel: 'Sleep',
            falseLabel: 'No sleep analysis requested',
        },
        schemaTitles: ['Athlete Identity', 'Daily Scores', 'Sleep'],
        formulaIds: WELLNESS_FORMULAS,
        macros: [],
        correlation: true,
    },
    [PREMIUM_DOMAIN.VALD]: {
        keywords: [
            'vald',
            'jump',
            'cmj',
            'strength',
            'force plate',
            'force-plate',
            'forceplate',
            'asymmetr',
            'every test',
            'all tests',
            'team tests',
            'player tests',
            'physical test',
            'performance test',
            'capacity test',
            'force test',
            'testing',
            'tests of',
            'test of',
        ],
        jev: {
            question: 'Does `prompt` ask to review physical/performance/capacity tests of the squad (VALD, force-plate, jump/CMJ, strength, asymmetries), or any wording like "every test", "all tests", "team tests", "player tests", "testing between dates"? Answer true for generic "tests" in a sports-science team-report sense — not software A/B tests.',
            trueLabel: 'VALD / physical / force-plate / team tests',
            falseLabel: 'No physical/VALD testing requested',
        },
        schemaTitles: [
            'Athlete Identity',
            'Strength Testing (VALD)',
            'Strength & Force Testing',
        ],
        formulaIds: CAPACITY_FORMULAS,
        macros: [
            {
                name: 'fetch_vald_tests',
                templateId: 'vald_tests',
                description: 'VALD force-plate trials per athlete',
            },
        ],
    },
    [PREMIUM_DOMAIN.BIOMARKERS]: {
        keywords: [
            'biomarker',
            'ck',
            'creatine',
            'blood',
            'lab marker',
            'blood test',
            'lab test',
        ],
        jev: {
            question: 'Does `prompt` ask about blood biomarkers, CK, lab blood work, or lab markers of fatigue/recovery? Do NOT treat generic "physical tests" / VALD / force-plate as biomarkers.',
            trueLabel: 'Biomarkers / CK / lab markers',
            falseLabel: 'No biomarker analysis requested',
        },
        schemaTitles: ['Athlete Identity', 'Biomarkers'],
        formulaIds: CAPACITY_FORMULAS,
        macros: [
            {
                name: 'fetch_biomarkers',
                templateId: 'biomarkers',
                description: 'Biomarker averages per athlete × type',
            },
        ],
    },
    [PREMIUM_DOMAIN.BODY]: {
        keywords: [
            'composition',
            'body fat',
            'weight',
            'bmi',
            'anthropo',
        ],
        jev: {
            question: 'Does `prompt` ask about body composition, weight, body fat %, or anthropometrics?',
            trueLabel: 'Body composition / weight / fat %',
            falseLabel: 'No body-metrics analysis requested',
        },
        schemaTitles: ['Athlete Identity', 'Body Metrics'],
        formulaIds: CAPACITY_FORMULAS,
        macros: [
            {
                name: 'fetch_body_metrics',
                templateId: 'body_metrics',
                description: 'Latest weight + fat % per athlete',
            },
        ],
    },
};
export const PREMIUM_CORRELATION_KEYWORDS = [
    'correl',
    'heatmap',
    'matrix',
    'association',
    'spearman',
    'pearson',
    'cross-metric',
    'relationship between',
];
export const PREMIUM_CORRELATION_JEV = {
    question: 'Does `prompt` ask to correlate, associate, link, or cross metrics (e.g. load×wellness, GPS×recovery, load↔sleep)?',
    trueLabel: 'Cross-metric correlation / association',
    falseLabel: 'No correlation analysis requested',
};
export const PREMIUM_SQL_FAILURE_CAP = 4;
export const PREMIUM_DOMAIN_NOUL_THRESHOLD = 0.4;
export const BASE_SCHEMA_TITLES = [
    'Athlete Identity',
    'Daily Scores',
    'Club & Positions Reference',
];
export const schemaTitlesForDomains = (domains) => {
    const titles = new Set(BASE_SCHEMA_TITLES);
    for (const domain of domains) {
        for (const title of PREMIUM_DOMAIN_CATALOG[domain].schemaTitles)
            titles.add(title);
    }
    return [...titles];
};
export const correlationDomains = () => PREMIUM_DOMAINS.filter((domain) => PREMIUM_DOMAIN_CATALOG[domain].correlation);
export const PREMIUM_TIME_SERIES_DOMAINS = [
    PREMIUM_DOMAIN.LOAD,
    PREMIUM_DOMAIN.GPS,
    PREMIUM_DOMAIN.MATCH,
    PREMIUM_DOMAIN.WELLNESS,
    PREMIUM_DOMAIN.SLEEP,
];
export const wantsTimeSeriesCharts = (domains) => domains.some((domain) => PREMIUM_TIME_SERIES_DOMAINS.includes(domain));
//# sourceMappingURL=premium_report_domains.js.map