import { randomUUID } from 'node:crypto';
import { CHART_DOWNSAMPLE_POINTS, CHART_SERIE_META, CHARTABLE_SERIE_TYPES, COMBINED_SERIES_COLORS, MAX_SERIES_CHARTS, SERIES_BAND_ZONE_EXCLUDE, SERIES_CHART_ALIASES, SERIES_CURVE_INTENT, SERIES_DAILY_AGGREGATE_EXCLUDE, SERIES_INTRA_SESSION_MARKERS, } from '#constants/agent_series.constants';
import { getValueKeyBySerieType } from '#utils/series';
import { decodeJsonPayload } from '#utils/statistics';
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SERIES_METRIC_ALLOWLIST = (() => {
    const parts = new Set();
    for (const aliases of Object.values(SERIES_CHART_ALIASES)) {
        for (const alias of aliases) {
            const escaped = escapeRegExp(alias.toLowerCase()).replace(/\s+/g, '\\s+');
            parts.add(escaped.endsWith('s') ? escaped : `${escaped}s?`);
        }
    }
    return new RegExp(`\\b(?:${[...parts].join('|')})\\b`, 'i');
})();
export const isSeriesChartQuestion = (q) => {
    const s = q.toLowerCase();
    if (SERIES_BAND_ZONE_EXCLUDE.test(s))
        return false;
    if (/\b(biomarkers?|biomarqueurs?|créatine\s*kinase|creatine\s*kinase|ck|ferritin|crp|y-?balance|fms)\b/i.test(s)) {
        return false;
    }
    if (SERIES_DAILY_AGGREGATE_EXCLUDE.test(s) && !SERIES_INTRA_SESSION_MARKERS.test(s)) {
        return false;
    }
    return SERIES_CURVE_INTENT.test(s) && SERIES_METRIC_ALLOWLIST.test(s);
};
export const isSeriesMetadataQuery = (sql) => /\bseries\b/i.test(sql) &&
    !/\bdata_encoded\b/i.test(sql) &&
    (/\b(s\.id|series\.id)\b/i.test(sql) || /\bAS\s+(?:serie_id|series_id)\b/i.test(sql));
export const isChartableSerieType = (v) => CHARTABLE_SERIE_TYPES.includes(v);
export const toJson = (value) => JSON.stringify(value);
export const parseSeriesMetadata = (raw) => {
    try {
        const parsed = JSON.parse(raw);
        if (parsed?._auto_decode !== true ||
            !Array.isArray(parsed.serie_ids) ||
            !parsed.serie_ids.every((x) => typeof x === 'string'))
            return null;
        return {
            _auto_decode: true,
            serie_ids: parsed.serie_ids,
            sql_type: typeof parsed.sql_type === 'string' && isChartableSerieType(parsed.sql_type)
                ? parsed.sql_type
                : null,
            ...(Array.isArray(parsed.athlete_ids) &&
                parsed.athlete_ids.every((x) => typeof x === 'string')
                ? { athlete_ids: parsed.athlete_ids }
                : {}),
        };
    }
    catch {
        return null;
    }
};
export const parseSeriesAutoDecoded = (raw) => {
    try {
        const o = JSON.parse(raw);
        return o?.auto_decoded === true && Array.isArray(o.series)
            ? o
            : null;
    }
    catch {
        return null;
    }
};
export const sessionLimitFromQuestion = (q) => {
    const m = q
        .toLowerCase()
        .match(/\b(\d+)\s*(?:derniers?|derni[eè]res?|last|latest|graphs?|graphiques?|courbes?|charts?)\b|\blast\s+(\d+)\b/i);
    const n = Number(m?.[1] ?? m?.[2]);
    return n >= 1 ? Math.min(n | 0, MAX_SERIES_CHARTS) : null;
};
export const wantsOneChartPerAthlete = (q) => /\b(chaque|each|tous|toutes|all|every|par joueur|par athl[eè]te|chaque joueur|chaque athl[eè]te)\b/i.test(q);
export const wantsSeparateCharts = (q) => !/\b(combin|compare|overlay|superpos|ensemble|m[eê]me graph|tous sur)\b/i.test(q);
export const inferSerieTypeFromSql = (sql, present) => CHARTABLE_SERIE_TYPES.find((t) => sql.includes(`'${t}'`) || sql.includes(`"${t}"`)) ??
    present.find(isChartableSerieType) ??
    null;
const round = (v, d) => (d == null ? Math.round(v) : +v.toFixed(d));
const pad = (n) => String(n).padStart(2, '0');
const formatElapsed = (sec) => {
    const h = (sec / 3600) | 0;
    const m = ((sec % 3600) / 60) | 0;
    const s = sec % 60 | 0;
    return h ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};
const yAxis = (label, min, max) => {
    const padY = Math.max(Math.ceil((max - min) * 0.1), 5);
    return {
        id: 'y',
        label,
        min: Math.max(0, min - padY),
        max: max + padY,
        position: 'left',
    };
};
const downsample = (points, decimals) => {
    if (points.length <= CHART_DOWNSAMPLE_POINTS)
        return points;
    const last = points.length - 1;
    const step = last / (CHART_DOWNSAMPLE_POINTS - 1);
    return Array.from({ length: CHART_DOWNSAMPLE_POINTS }, (_, i) => {
        const p = points[i === CHART_DOWNSAMPLE_POINTS - 1 ? last : Math.round(i * step)];
        return { ts: p.ts, value: round(p.value, decimals) };
    });
};
const resampleValues = (points) => {
    if (!points.length)
        return Array(CHART_DOWNSAMPLE_POINTS).fill(0);
    const t0 = points[0].ts;
    const span = Math.max(points.at(-1).ts - t0, 1e-6);
    let cursor = 0;
    return Array.from({ length: CHART_DOWNSAMPLE_POINTS }, (_, i) => {
        const target = t0 + (span * i) / (CHART_DOWNSAMPLE_POINTS - 1);
        while (cursor < points.length - 2 && points[cursor + 1].ts < target)
            cursor++;
        const a = points[cursor];
        const b = points[Math.min(cursor + 1, points.length - 1)];
        return Math.abs(target - a.ts) <= Math.abs(target - b.ts) ? a.value : b.value;
    });
};
export const decodeSerieForChart = (dataEncoded, type) => {
    if (!isChartableSerieType(type))
        return [];
    const meta = CHART_SERIE_META[type];
    const key = getValueKeyBySerieType(type);
    const raw = decodeJsonPayload(dataEncoded).points;
    if (!Array.isArray(raw) || !raw.length)
        return [];
    const points = [];
    for (const p of raw) {
        const value = p[key];
        if (typeof p.ts !== 'number' || typeof value !== 'number' || !Number.isFinite(value))
            continue;
        if (meta.validate && !meta.validate(value))
            continue;
        points.push({ ts: Math.round(p.ts), value: round(value, meta.decimals) });
    }
    if (!points.length)
        return [];
    points.sort((a, b) => a.ts - b.ts);
    const t0 = points[0].ts;
    const normalized = downsample(points.map(({ ts, value }) => ({ ts: Math.max(0, ts - t0), value })), meta.decimals);
    return normalized;
};
export const buildSerieCharts = (curves, separate) => {
    if (!curves.length)
        return [];
    const metaOf = (t) => (isChartableSerieType(t) ? CHART_SERIE_META[t] : undefined);
    if (separate || curves.length === 1) {
        return curves.map((c) => {
            const meta = metaOf(c.type);
            const label = meta?.label ?? c.type;
            const color = meta?.color ?? '#F87171';
            return {
                id: randomUUID(),
                kind: 'line',
                title: `${c.athleteName} — ${label}${c.sessionDate ? ` (${c.sessionDate})` : ''}`,
                labels: c.points.map((p) => formatElapsed(p.ts)),
                datasets: [
                    {
                        label: c.athleteName,
                        data: c.points.map((p) => p.value),
                        borderColor: color,
                        yAxisID: 'y',
                    },
                ],
                yAxes: [yAxis(label, c.min, c.max)],
                serieType: c.type,
                sessionDate: c.sessionDate || undefined,
            };
        });
    }
    const label = metaOf(curves[0].type)?.label ?? curves[0].type;
    const colors = COMBINED_SERIES_COLORS;
    let min = Infinity;
    let max = -Infinity;
    const datasets = curves.map((c, i) => {
        const data = resampleValues(c.points);
        for (const v of data) {
            min = Math.min(min, v);
            max = Math.max(max, v);
        }
        const color = colors[i % colors.length];
        return {
            label: c.sessionDate ? `${c.athleteName} (${c.sessionDate})` : c.athleteName,
            data,
            borderColor: color,
            yAxisID: 'y',
        };
    });
    return [
        {
            id: randomUUID(),
            kind: 'line',
            title: `${label} — combined`,
            labels: Array.from({ length: CHART_DOWNSAMPLE_POINTS }, (_, i) => `${Math.round((100 * i) / (CHART_DOWNSAMPLE_POINTS - 1))}%`),
            datasets,
            yAxes: [yAxis(label, min, max)],
            serieType: curves[0].type,
        },
    ];
};
//# sourceMappingURL=agent_series.js.map