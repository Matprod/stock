import db from '@adonisjs/lucid/services/db';
import { MAX_SERIES_CHARTS } from '#constants/agent_series.constants';
import Serie from '#models_pg/serie';
import { buildSerieCharts, decodeSerieForChart, inferSerieTypeFromSql, isChartableSerieType, parseSeriesMetadata, sessionLimitFromQuestion, toJson, wantsOneChartPerAthlete, wantsSeparateCharts, } from '#utils/agent/agent_series';
export const autoDecodeSeriesToolResult = async (toolResult, context, onChart, question = '') => {
    const metadata = parseSeriesMetadata(toolResult);
    if (!metadata)
        return null;
    try {
        const ids = metadata.serie_ids.slice(0, MAX_SERIES_CHARTS * 3);
        if (!ids.length)
            return emptyDecoded();
        let series = (await loadSeriesByIds(ids)).filter((s) => isChartableSerieType(s.type));
        const serieType = metadata.sql_type && series.some((s) => s.type === metadata.sql_type)
            ? metadata.sql_type
            : inferSerieTypeFromSql('', series.map((s) => s.type));
        if (serieType)
            series = series.filter((s) => s.type === serieType);
        sortNewestFirst(series);
        const sessionLimit = sessionLimitFromQuestion(question);
        const rosterBackfill = context?.mode === 'team' && wantsOneChartPerAthlete(question);
        const onePerAthlete = context?.mode === 'team' && (sessionLimit == null || rosterBackfill);
        const teamTarget = rosterBackfill
            ? Math.min(MAX_SERIES_CHARTS, context.athleteIds.length || MAX_SERIES_CHARTS)
            : null;
        const chartCap = sessionLimit ?? teamTarget ?? MAX_SERIES_CHARTS;
        const curves = [];
        const seenActivities = new Set();
        const seenAthletes = new Set();
        const seenSerieIds = new Set();
        const batchArgs = {
            context,
            curves,
            onePerAthlete,
            chartCap,
            seenActivities,
            seenAthletes,
            seenSerieIds,
        };
        const scopeError = consumeSeriesBatch(series, batchArgs);
        if (scopeError)
            return toJson({ error: scopeError });
        const needMore = serieType &&
            ((sessionLimit != null && curves.length < sessionLimit) ||
                (teamTarget != null && curves.length < teamTarget));
        if (needMore) {
            const athleteIds = rosterBackfill && context?.mode === 'team'
                ? context.athleteIds.filter((id) => !seenAthletes.has(id))
                : resolveAthleteIds(metadata, context, series);
            const missing = chartCap - curves.length;
            const more = await fetchAdditionalSeries(serieType, athleteIds.length ? athleteIds : resolveAthleteIds(metadata, context, series), [...seenSerieIds], Math.min(400, Math.max(missing * 20, 50)));
            const err = consumeSeriesBatch(more, batchArgs);
            if (err)
                return toJson({ error: err });
        }
        if (!curves.length)
            return emptyDecoded();
        curves.sort((a, b) => b.sessionDate.localeCompare(a.sessionDate) || a.athleteName.localeCompare(b.athleteName));
        const separate = wantsSeparateCharts(question) || curves.length === 1;
        const charts = buildSerieCharts(curves, separate);
        charts.forEach(onChart);
        const requested = sessionLimit ?? teamTarget;
        const partial = requested != null && curves.length < requested;
        const summary = curves.map((c) => ({
            athleteName: c.athleteName,
            serieType: c.type,
            sessionDate: c.sessionDate,
            min: c.min,
            max: c.max,
            durationSec: c.durationSec,
        }));
        return toJson({
            auto_decoded: true,
            curveCount: curves.length,
            chartCount: charts.length,
            layout: separate ? 'separate' : 'combined',
            serieType: curves[0].type,
            series: summary,
            note: partial
                ? `${charts.length} chart(s) — partial vs requested ${requested}. Do not replot.`
                : `${charts.length} chart(s). Do not replot.`,
            ...(partial ? { requested, missing: requested - curves.length, partial: true } : {}),
        });
    }
    catch (err) {
        return toJson({ error: err instanceof Error ? err.message : String(err) });
    }
};
export const compactSeriesMetadataResult = (rows, sql) => {
    const ids = [];
    const types = [];
    const athleteIds = [];
    const seenIds = new Set();
    const seenAthletes = new Set();
    for (const row of rows) {
        if (!row || typeof row !== 'object')
            continue;
        const r = row;
        const id = String(r.id ?? r.serie_id ?? '').trim();
        const type = r.type != null ? String(r.type) : '';
        const athleteId = String(r.athlete_id ?? r.athleteId ?? '').trim();
        if (!id || seenIds.has(id) || (type && !isChartableSerieType(type)))
            continue;
        seenIds.add(id);
        ids.push(id);
        if (type)
            types.push(type);
        if (athleteId && !seenAthletes.has(athleteId)) {
            seenAthletes.add(athleteId);
            athleteIds.push(athleteId);
        }
    }
    if (!ids.length) {
        return toJson({
            error: 'NO_CHARTABLE_SERIES',
            hint: 'SELECT s.id,s.type,a.id AS athlete_id — ONE s.type.',
        });
    }
    if (ids.length > MAX_SERIES_CHARTS && !/\b(ROW_NUMBER|DISTINCT\s+ON|LIMIT\s+\d)/i.test(sql)) {
        return toJson({
            error: 'TOO_MANY_SERIES',
            n: ids.length,
            hint: `LIMIT or DISTINCT ON. Max ${MAX_SERIES_CHARTS}.`,
        });
    }
    return toJson({
        _auto_decode: true,
        serie_ids: ids.slice(0, MAX_SERIES_CHARTS * 3),
        sql_type: inferSerieTypeFromSql(sql, types),
        ...(athleteIds.length ? { athlete_ids: athleteIds } : {}),
    });
};
const consumeSeriesBatch = (batch, args) => {
    const { context, curves, onePerAthlete, chartCap, seenActivities, seenAthletes, seenSerieIds } = args;
    for (const serie of batch) {
        if (curves.length >= chartCap)
            break;
        if (seenSerieIds.has(serie.id))
            continue;
        seenSerieIds.add(serie.id);
        const activityId = serie.period?.sportActivityId ?? serie.period?.sportActivity?.id ?? '';
        if (activityId && seenActivities.has(activityId))
            continue;
        const day = serie.period?.sportActivity?.day;
        const athleteId = day?.athleteId ?? '';
        if (onePerAthlete && (!athleteId || seenAthletes.has(athleteId)))
            continue;
        const scopeError = assertSerieInScope(context, athleteId);
        if (scopeError)
            return scopeError;
        const points = decodeSerieForChart(serie.dataEncoded ?? '', serie.type);
        if (!points.length)
            continue;
        const values = points.map((p) => p.value);
        const athlete = day?.athlete;
        if (activityId)
            seenActivities.add(activityId);
        if (athleteId)
            seenAthletes.add(athleteId);
        curves.push({
            athleteName: `${athlete?.firstName?.trim() ?? ''} ${athlete?.lastName?.trim() ?? ''}`.trim() ||
                'Athlete',
            sessionDate: day?.dateOfDay?.toISODate?.() ?? '',
            type: serie.type,
            points,
            min: Math.min(...values),
            max: Math.max(...values),
            durationSec: points.at(-1).ts,
        });
    }
    return null;
};
const loadSeriesByIds = async (ids) => {
    if (!ids.length)
        return [];
    return Serie.query()
        .whereIn('id', ids)
        .preload('period', (pq) => pq.preload('sportActivity', (sq) => sq.preload('day', (dq) => dq.preload('athlete'))));
};
const fetchAdditionalSeries = async (type, athleteIds, excludeIds, limit) => {
    if (!athleteIds.length || limit <= 0)
        return [];
    let query = db
        .from('series as s')
        .join('periods as p', 'p.id', 's.period_id')
        .join('sport_activities as sa', 'sa.id', 'p.sport_activity_id')
        .join('days as d', 'd.id', 'sa.day_id')
        .where('s.type', type)
        .whereIn('d.athlete_id', athleteIds)
        .select('s.id')
        .orderBy([
        { column: 'd.date_of_day', order: 'desc' },
        { column: 'sa.time_of_activity', order: 'desc', nulls: 'last' },
        { column: 'p.start_time', order: 'desc', nulls: 'last' },
    ])
        .limit(limit);
    if (excludeIds.length)
        query = query.whereNotIn('s.id', excludeIds);
    const rows = await query;
    const loaded = await loadSeriesByIds(rows.map((r) => String(r.id)));
    const byId = new Map(loaded.map((s) => [s.id, s]));
    return rows.map((r) => byId.get(String(r.id))).filter((s) => Boolean(s));
};
const assertSerieInScope = (context, athleteId) => {
    if (!athleteId || !context)
        return null;
    if (context.mode === 'athlete' && athleteId !== context.athleteId)
        return `Series out of scope for athlete ${athleteId}`;
    if (context.mode === 'team' && !context.athleteIds.includes(athleteId))
        return `Series out of scope for athlete ${athleteId}`;
    return null;
};
const resolveAthleteIds = (metadata, context, series) => {
    const ids = new Set(metadata.athlete_ids ?? []);
    for (const s of series) {
        const id = s.period?.sportActivity?.day?.athleteId;
        if (id)
            ids.add(id);
    }
    if (context?.mode === 'athlete')
        ids.add(context.athleteId);
    return [...ids];
};
const serieSortKey = (serie) => {
    const day = serie.period?.sportActivity?.day;
    const time = serie.period?.startTime?.toISO?.() ?? serie.period?.sportActivity?.timeOfActivity ?? '00:00:00';
    return `${day?.dateOfDay?.toISODate?.() ?? ''}T${time}`;
};
const sortNewestFirst = (list) => {
    list.sort((a, b) => serieSortKey(b).localeCompare(serieSortKey(a)));
};
const emptyDecoded = () => toJson({ auto_decoded: true, curveCount: 0, series: [] });
//# sourceMappingURL=agent_series_service.js.map