import { isReportConvertUnit } from '#constants/report_builder.constants';
const MS_PER_HOUR = 1000 * 60 * 60;
const UNIT_ALIASES = {
    s: 's',
    sec: 's',
    seconde: 's',
    secondes: 's',
    second: 's',
    seconds: 's',
    m: 'm',
    metre: 'm',
    metres: 'm',
    meter: 'm',
    meters: 'm',
    min: 'min',
    minute: 'min',
    minutes: 'min',
    h: 'h',
    heure: 'h',
    heures: 'h',
    hour: 'h',
    hours: 'h',
    km: 'km',
    kilometre: 'km',
    kilometres: 'km',
    kilometer: 'km',
    kilometers: 'km',
};
const TIME_TO_SECONDS = {
    s: 1,
    min: 60,
    h: 3600,
};
const DISTANCE_TO_METERS = {
    m: 1,
    km: 1000,
};
const UNIT_LABELS = {
    en: { s: 'seconds', m: 'meters', min: 'minutes', h: 'h', km: 'km' },
    fr: { s: 'secondes', m: 'mètres', min: 'minutes', h: 'h', km: 'km' },
};
export const periodMetricValuesTable = (useImputedMetrics) => useImputedMetrics ? 'data_processed_metric_values as pmv' : 'period_metric_values as pmv';
export const toHoursFactor = (field) => {
    if (field.endsWith('Milli'))
        return 1 / MS_PER_HOUR;
    if (field === 'durationSeconds')
        return 1 / 3600;
    return null;
};
export const normalizeUnit = (unit) => {
    if (!unit?.trim())
        return null;
    const key = unit.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    return UNIT_ALIASES[key] ?? unit.trim();
};
export const displayUnit = (field, unit) => toHoursFactor(field) ? 'h' : normalizeUnit(unit);
export const translateUnit = (unit, language) => {
    const normalized = normalizeUnit(unit);
    if (!normalized)
        return null;
    return UNIT_LABELS[language][normalized] ?? normalized;
};
export const parseConvertUnit = (value) => {
    const normalized = normalizeUnit(value);
    if (!normalized || !isReportConvertUnit(normalized))
        return undefined;
    return normalized;
};
export const unitConversionFactor = (from, to) => {
    const source = normalizeUnit(from);
    const target = normalizeUnit(to);
    if (!source || !target)
        return null;
    if (source === target)
        return 1;
    if (source in TIME_TO_SECONDS && target in TIME_TO_SECONDS) {
        return TIME_TO_SECONDS[source] / TIME_TO_SECONDS[target];
    }
    if (source in DISTANCE_TO_METERS && target in DISTANCE_TO_METERS) {
        return DISTANCE_TO_METERS[source] / DISTANCE_TO_METERS[target];
    }
    return null;
};
export const convertSeriesValues = (series, factor) => series.map((value) => typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value * factor * 1000) / 1000
    : null);
export const formatHours = (hours) => {
    const totalMinutes = Math.round(Math.abs(hours) * 60);
    const sign = hours < 0 ? '-' : '';
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h === 0)
        return `${sign}${m}min`;
    if (m === 0)
        return `${sign}${h}h`;
    return `${sign}${h}h ${m}min`;
};
//# sourceMappingURL=report_units.js.map