import db from '@adonisjs/lucid/services/db';
import { gpsDistanceAliasesForClub, gpsDurationAliasesForClub, gpsIntensityKpisForClub, MATCH_STATS_KPIS, playerLoadSourcesForClub, } from '#constants/premium_report_metrics';
import { PREMIUM_SQL_TEMPLATE, } from '#services/premium_report/premium_report_sql_templates';
export const loadPeriodMetricUnits = async (clubId, metricNames) => {
    const names = [...new Set(metricNames.filter(Boolean))];
    if (names.length === 0)
        return {};
    const rows = await db
        .from('period_metrics as pm')
        .leftJoin('period_metric_club_units as pmcu', function () {
        this.on('pmcu.metric_id', '=', 'pm.id').andOnVal('pmcu.club_id', clubId);
    })
        .whereIn('pm.name', names)
        .select('pm.name')
        .select(db.raw('COALESCE(pmcu.unit, pm.unit) AS unit'));
    const out = {};
    for (const row of rows) {
        const name = String(row.name ?? '');
        const unit = row.unit != null ? String(row.unit).trim() : '';
        if (name && unit)
            out[name] = unit;
    }
    return out;
};
export const loadSportActivityMetricUnits = async (metricNames) => {
    const names = [...new Set(metricNames.filter(Boolean))];
    if (names.length === 0)
        return {};
    const rows = await db
        .from('sport_activity_metrics as sam')
        .whereIn('sam.name', names)
        .select('sam.name', 'sam.unit');
    const out = {};
    for (const row of rows) {
        const name = String(row.name ?? '');
        const unit = row.unit != null ? String(row.unit).trim() : '';
        if (name && unit)
            out[name] = unit;
    }
    return out;
};
export const resolveTemplateColumnUnits = async (clubId, templateId) => {
    if (templateId === PREMIUM_SQL_TEMPLATE.GPS_INTENSITY ||
        templateId === PREMIUM_SQL_TEMPLATE.GPS_INTENSITY_DAILY) {
        const kpis = gpsIntensityKpisForClub(clubId);
        const loadSources = playerLoadSourcesForClub(clubId);
        const byName = await loadPeriodMetricUnits(clubId, [...kpis.map((k) => k.name), ...loadSources]);
        const units = {};
        for (const kpi of kpis) {
            const unit = byName[kpi.name];
            if (unit)
                units[kpi.alias] = unit;
        }
        const loadUnit = loadSources.map((name) => byName[name]).find(Boolean);
        if (loadUnit) {
            units.player_load = loadUnit;
            units.dsl = loadUnit;
        }
        return units;
    }
    if (templateId === PREMIUM_SQL_TEMPLATE.GPS_DISTANCE) {
        const distanceAliases = gpsDistanceAliasesForClub(clubId);
        const durationAliases = gpsDurationAliasesForClub(clubId);
        const byName = await loadPeriodMetricUnits(clubId, [...distanceAliases, ...durationAliases]);
        const units = {};
        const distanceUnit = distanceAliases.map((name) => byName[name]).find(Boolean);
        const durationUnit = durationAliases.map((name) => byName[name]).find(Boolean);
        if (distanceUnit) {
            units.distance_m = distanceUnit;
            units.total_distance_m = distanceUnit;
        }
        if (durationUnit)
            units.total_minutes = durationUnit === 's' ? 'min' : durationUnit;
        return units;
    }
    if (templateId === PREMIUM_SQL_TEMPLATE.MATCH_STATS) {
        const byName = await loadSportActivityMetricUnits(MATCH_STATS_KPIS.map((k) => k.name));
        const units = {};
        for (const kpi of MATCH_STATS_KPIS) {
            const unit = byName[kpi.name];
            if (unit)
                units[kpi.alias] = unit;
        }
        return units;
    }
    return {};
};
//# sourceMappingURL=period_metric_units.js.map