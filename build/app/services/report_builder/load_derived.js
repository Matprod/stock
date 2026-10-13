import { DateTime } from 'luxon';
import { DERIVED_DAY_SCORE_FIELDS, DERIVED_INJURY_FIELDS, DERIVED_TABLE_FIELDS, INJURY_LOG_COLUMNS, } from '#constants/report_builder.constants';
import Day from '#models_pg/day';
import Injury from '#models_pg/injury';
const emptyPoints = (definitions) => new Map(definitions.map((definition) => [definition.key, []]));
const dayIsoDate = (dateOfDay) => {
    if (DateTime.isDateTime(dateOfDay))
        return dateOfDay.toISODate();
    if (dateOfDay instanceof Date)
        return DateTime.fromJSDate(dateOfDay, { zone: 'utc' }).toISODate();
    return String(dateOfDay).slice(0, 10);
};
const parseIsoDay = (value) => DateTime.fromISO(value).startOf('day');
const loadDayScorePoints = async (clubId, dateRange, definitions) => {
    const pointsByKey = emptyPoints(definitions);
    if (definitions.length === 0)
        return pointsByKey;
    const fields = [...new Set(definitions.map((definition) => definition.field))];
    const days = await Day.query()
        .whereBetween('dateOfDay', [dateRange.from, dateRange.to])
        .whereHas('athlete', (athleteQuery) => athleteQuery.where('clubId', clubId))
        .select(['id', 'athleteId', 'dateOfDay', ...fields]);
    for (const day of days) {
        const date = dayIsoDate(day.dateOfDay);
        if (!date)
            continue;
        for (const definition of definitions) {
            let value = null;
            if (definition.field === 'performanceScore')
                value = day.performanceScore;
            else if (definition.field === 'injuryRiskScore')
                value = day.injuryRiskScore;
            if (value === null)
                continue;
            pointsByKey.get(definition.key).push({
                date,
                value,
                athleteId: day.athleteId,
            });
        }
    }
    return pointsByKey;
};
const loadInjuryPoints = async (clubId, dateRange, definitions) => {
    const pointsByKey = emptyPoints(definitions);
    if (definitions.length === 0)
        return pointsByKey;
    const from = parseIsoDay(dateRange.from);
    const to = parseIsoDay(dateRange.to);
    if (!from.isValid || !to.isValid)
        return pointsByKey;
    const injuries = await Injury.query()
        .whereNotNull('dateOfInjury')
        .whereHas('athlete', (athleteQuery) => athleteQuery.where('clubId', clubId))
        .where('dateOfInjury', '<=', dateRange.to)
        .where((query) => {
        query.whereNull('recoveryDate').orWhere('recoveryDate', '>=', dateRange.from);
    })
        .select(['id', 'athleteId', 'dateOfInjury', 'recoveryDate']);
    const newInjuriesKey = definitions.find((definition) => definition.field === 'newInjuries')?.key;
    const injuryDaysKey = definitions.find((definition) => definition.field === 'injuryDays')?.key;
    const seenInjuryDays = new Set();
    for (const injury of injuries) {
        const started = dayIsoDate(injury.dateOfInjury);
        if (!started)
            continue;
        if (newInjuriesKey && started >= dateRange.from && started <= dateRange.to) {
            pointsByKey.get(newInjuriesKey).push({
                date: started,
                value: 1,
                athleteId: injury.athleteId,
            });
        }
        if (!injuryDaysKey)
            continue;
        let start = parseIsoDay(started);
        if (start < from)
            start = from;
        const recovered = injury.recoveryDate ? dayIsoDate(injury.recoveryDate) : null;
        let end = recovered ? parseIsoDay(recovered) : to;
        if (end > to)
            end = to;
        if (end < start)
            continue;
        for (let cursor = start; cursor <= end; cursor = cursor.plus({ days: 1 })) {
            const date = cursor.toISODate();
            const stamp = `${injury.athleteId}:${date}`;
            if (seenInjuryDays.has(stamp))
                continue;
            seenInjuryDays.add(stamp);
            pointsByKey.get(injuryDaysKey).push({
                date,
                value: 1,
                athleteId: injury.athleteId,
            });
        }
    }
    return pointsByKey;
};
export const loadDerivedData = async (clubId, dateRange, definitions) => {
    const scoreDefs = definitions.filter((definition) => DERIVED_DAY_SCORE_FIELDS.includes(definition.field));
    const injuryDefs = definitions.filter((definition) => DERIVED_INJURY_FIELDS.includes(definition.field));
    const [scores, injuries] = await Promise.all([
        loadDayScorePoints(clubId, dateRange, scoreDefs),
        loadInjuryPoints(clubId, dateRange, injuryDefs),
    ]);
    return new Map([...scores, ...injuries]);
};
const injuryOverlapQuery = (clubId, dateRange) => Injury.query()
    .whereNotNull('dateOfInjury')
    .whereHas('athlete', (athleteQuery) => athleteQuery.where('clubId', clubId))
    .where('dateOfInjury', '<=', dateRange.to)
    .where((query) => {
    query.whereNull('recoveryDate').orWhere('recoveryDate', '>=', dateRange.from);
});
const loadInjuryLogTable = async (clubId, dateRange) => {
    const columns = INJURY_LOG_COLUMNS.map((column) => ({ key: column.key, label: column.label }));
    const injuries = await injuryOverlapQuery(clubId, dateRange)
        .preload('athlete')
        .preload('injuryType', (query) => query.preload('section'))
        .orderBy('dateOfInjury', 'desc');
    const rows = [];
    for (const injury of injuries) {
        const start = dayIsoDate(injury.dateOfInjury);
        if (!start)
            continue;
        const end = injury.recoveryDate ? dayIsoDate(injury.recoveryDate) : null;
        const typeName = injury.injuryType?.name?.trim() || '';
        const pathology = injury.pathology?.trim() || '';
        rows.push({
            key: injury.id,
            athleteId: injury.athleteId,
            start,
            end,
            cells: {
                player: injury.athlete?.name?.trim() || injury.athleteId,
                injury: pathology || typeName || 'Injury',
                location: injury.injuryType?.section?.name?.trim() || '',
                from: start,
                to: end ?? '',
                status: end ? 'recovered' : 'ongoing',
                context: injury.context ?? '',
            },
        });
    }
    return { columns, rows };
};
export const loadDerivedTables = async (clubId, dateRange, definitions) => {
    const tables = new Map();
    const logDefs = definitions.filter((definition) => DERIVED_TABLE_FIELDS.includes(definition.field));
    if (logDefs.length === 0)
        return tables;
    const log = await loadInjuryLogTable(clubId, dateRange);
    for (const definition of logDefs)
        tables.set(definition.key, log);
    return tables;
};
//# sourceMappingURL=load_derived.js.map