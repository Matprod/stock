import { STATSSPORTS_CONTEXT_FIELDS, STATSSPORTS_PERIOD_METRICS, } from '#constants/statsports.constants';
import { DateTime } from 'luxon';
export const parseIsoDateTime = (value) => {
    const trimmed = value.trim();
    const normalized = trimmed.endsWith('Z') ? trimmed.replace(/Z$/, '+00:00') : trimmed;
    const parsed = DateTime.fromISO(normalized, { zone: 'utc' });
    if (!parsed.isValid) {
        throw new Error(`Invalid ISO datetime: ${value}`);
    }
    return parsed;
};
export const toIsoZ = (value) => {
    const utc = value.toUTC();
    const base = utc.toFormat("yyyy-MM-dd'T'HH:mm:ss");
    const fraction = utc.toFormat('SSS').replace(/0+$/, '');
    return fraction ? `${base}.${fraction}Z` : `${base}Z`;
};
export const iterateChunks = function* (start, end, chunkDays) {
    if (chunkDays <= 0) {
        yield [start, end];
        return;
    }
    let current = start;
    const step = { days: chunkDays };
    while (current <= end) {
        const next = DateTime.min(current.plus(step).minus({ seconds: 1 }), end);
        yield [current, next];
        current = next.plus({ seconds: 1 });
    }
};
export const splitWindow = (start, end) => {
    if (end <= start) {
        throw new Error('Invalid window');
    }
    if (start.toISODate() !== end.toISODate()) {
        const days = Math.floor(end.diff(start, 'days').days);
        const midDate = start.plus({ days: Math.floor(days / 2) }).toISODate();
        const leftEnd = DateTime.min(DateTime.fromISO(`${midDate}T23:59:59`, { zone: 'utc' }), end);
        const rightStart = leftEnd.plus({ seconds: 1 });
        if (rightStart > end || leftEnd < start) {
            throw new Error('Cannot split multi-day window');
        }
        return [
            [start, leftEnd],
            [rightStart, end],
        ];
    }
    const midMillis = start.toMillis() + (end.toMillis() - start.toMillis()) / 2;
    const mid = DateTime.fromMillis(midMillis, { zone: 'utc' });
    let leftEnd = mid;
    let rightStart = mid.plus({ milliseconds: 1 });
    if (rightStart >= end) {
        rightStart = mid.plus({ seconds: 1 });
    }
    if (rightStart >= end || leftEnd <= start) {
        throw new Error('Cannot split same-day window');
    }
    return [
        [start, leftEnd],
        [rightStart, end],
    ];
};
const toNullableNumber = (value) => {
    if (typeof value === 'number')
        return Number.isFinite(value) ? value : null;
    if (value === null || value === undefined || value === '')
        return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
};
const toNullableScalar = (value) => {
    if (value === null || value === undefined || value === '')
        return null;
    if (typeof value === 'number')
        return Number.isFinite(value) ? value : null;
    if (typeof value === 'string')
        return value;
    return String(value);
};
const emptyContext = () => {
    const context = {};
    for (const key of STATSSPORTS_CONTEXT_FIELDS) {
        context[key] = null;
    }
    return context;
};
const emptyPeriodMetrics = () => {
    const metrics = {};
    for (const key of STATSSPORTS_PERIOD_METRICS) {
        metrics[key] = null;
    }
    return metrics;
};
const mapPlayerContext = (player) => {
    return {
        player_customPlayerId: toNullableScalar(player.customPlayerId),
        player_activeSquadName: toNullableScalar(player.activeSquadName),
        player_firstName: toNullableScalar(player.firstName),
        player_lastName: toNullableScalar(player.lastName),
        player_primaryPosition: toNullableScalar(player.primaryPosition),
        player_maxSpeed: toNullableScalar(player.maxSpeed),
        player_maxHeartRate: toNullableScalar(player.maxHeartRate),
        player_restingHeartRate: toNullableScalar(player.restingHeartRate),
        player_dateOfBirth: toNullableScalar(player.dateOfBirth),
        player_height: toNullableScalar(player.height),
        player_weight: toNullableScalar(player.weight),
    };
};
const mapSessionContext = (session) => {
    return {
        session_date: toNullableScalar(session.sessionDate),
        session_type: toNullableScalar(session.sessionType),
        session_start_time: toNullableScalar(session.startTime),
        session_end_time: toNullableScalar(session.endTime),
    };
};
const mapDrillContext = (drill) => {
    if (!drill) {
        return {
            drill_id: null,
            drill_name: null,
            drill_start_time: null,
            drill_end_time: null,
        };
    }
    return {
        drill_id: toNullableScalar(drill.id),
        drill_name: toNullableScalar(drill.drillName),
        drill_start_time: toNullableScalar(drill.startTime),
        drill_end_time: toNullableScalar(drill.endTime),
    };
};
const mapDrillKpis = (drill) => {
    const metrics = emptyPeriodMetrics();
    const kpi = drill?.drillKpi;
    if (!kpi)
        return metrics;
    for (const key of STATSSPORTS_PERIOD_METRICS) {
        metrics[key] = toNullableNumber(kpi[key.slice('kpi_'.length)]);
    }
    return metrics;
};
const mapPlayerBase = (sessionPlayer, session, sessionId) => {
    return {
        ...emptyContext(),
        ...mapSessionContext(session),
        ...mapPlayerContext(sessionPlayer.playerDetails ?? {}),
        session_id: toNullableScalar(sessionId),
        session_player_id: toNullableScalar(sessionPlayer.id),
    };
};
const mapRow = (context, drill) => {
    return {
        ...context,
        ...mapDrillContext(drill),
        ...mapDrillKpis(drill),
    };
};
export const mapBundleToRows = (bundle) => {
    const session = bundle.sessionDetails ?? {};
    const sessionId = bundle.id ?? null;
    const rows = [];
    for (const sessionPlayer of bundle.sessionPlayers ?? []) {
        const base = mapPlayerBase(sessionPlayer, session, sessionId);
        const drills = sessionPlayer.drills ?? [];
        if (drills.length === 0) {
            rows.push(mapRow(base, null));
            continue;
        }
        for (const drill of drills) {
            rows.push(mapRow(base, drill));
        }
    }
    return rows;
};
export const splitApiRow = (apiRow) => {
    const periodMetrics = {};
    const context = {};
    for (const key of STATSSPORTS_PERIOD_METRICS) {
        periodMetrics[key] =
            typeof apiRow[key] === 'number' ? apiRow[key] : toNullableNumber(apiRow[key]);
    }
    for (const key of STATSSPORTS_CONTEXT_FIELDS) {
        context[key] = apiRow[key];
    }
    return { periodMetrics, context };
};
export const toScalarString = (value) => {
    if (value === null || value === undefined || value === '')
        return null;
    const text = String(value).trim();
    return text || null;
};
export const normalizeActivityTime = (timeOfActivity) => {
    const text = toScalarString(timeOfActivity);
    if (!text || text === '00:00:00' || text === '0:00:00' || text === '00:00')
        return null;
    const iso = DateTime.fromISO(text, { zone: 'utc' });
    if (iso.isValid && text.includes('T'))
        return iso.toFormat('HH:mm:ss');
    const match = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!match)
        return text;
    const hours = match[1].padStart(2, '0');
    const minutes = match[2];
    const seconds = (match[3] ?? '00').padStart(2, '0');
    const normalized = `${hours}:${minutes}:${seconds}`;
    if (normalized === '00:00:00')
        return null;
    return normalized;
};
export const isStatsportsGameSession = (sessionType) => {
    const text = toScalarString(sessionType);
    if (!text)
        return false;
    const normalized = text.toLowerCase().replace(/\s+/g, ' ');
    if (/match\s*day\s*[-+]/.test(normalized))
        return false;
    if (/match\s*day.*\bgps\b/.test(normalized))
        return false;
    if (/macth\s*day/.test(normalized))
        return false;
    const compact = normalized.replace(/[\s_-]+/g, '');
    return compact === 'friendlymatch' || compact === 'matchday';
};
const combineDateAndTime = (sessionDate, time) => {
    const timeText = toScalarString(time);
    if (!timeText)
        return null;
    const iso = DateTime.fromISO(timeText, { zone: 'utc' });
    if (iso.isValid && timeText.includes('T'))
        return iso;
    const dateStr = sessionDate.trim().slice(0, 10);
    const parsed = DateTime.fromISO(`${dateStr}T${timeText}`, { zone: 'utc' });
    return parsed.isValid ? parsed : null;
};
export const resolvePeriodTimes = (sessionDateIso, drillStartTime, drillEndTime, totalTimeSeconds) => {
    let startTime = combineDateAndTime(sessionDateIso, drillStartTime);
    let endTime = combineDateAndTime(sessionDateIso, drillEndTime);
    if (startTime && endTime && endTime <= startTime) {
        if (totalTimeSeconds && totalTimeSeconds > 0) {
            endTime = startTime.plus({ seconds: totalTimeSeconds });
        }
        else {
            startTime = null;
            endTime = null;
        }
    }
    if (startTime && !endTime && totalTimeSeconds && totalTimeSeconds > 0) {
        endTime = startTime.plus({ seconds: totalTimeSeconds });
    }
    if (!startTime && endTime && totalTimeSeconds && totalTimeSeconds > 0) {
        startTime = endTime.minus({ seconds: totalTimeSeconds });
    }
    if (startTime && endTime && endTime <= startTime) {
        return { startTime: null, endTime: null };
    }
    return { startTime, endTime };
};
export const buildPeriodProviderId = (context, periodMetrics) => {
    const drillId = toScalarString(context.drill_id);
    if (drillId)
        return drillId;
    return [
        context.player_customPlayerId,
        context.session_id,
        context.drill_name,
        context.drill_start_time,
        periodMetrics.kpi_totalTime,
    ]
        .map((value) => (value === null || value === undefined ? '' : String(value).trim()))
        .join('|');
};
export const compactPeriodMetrics = (periodMetrics) => {
    return Object.fromEntries(Object.entries(periodMetrics).filter((entry) => entry[1] !== null));
};
export const computeSessionDurationSeconds = (context) => {
    const sessionDate = toScalarString(context.session_date);
    if (!sessionDate)
        return null;
    const start = combineDateAndTime(sessionDate, context.session_start_time);
    const end = combineDateAndTime(sessionDate, context.session_end_time);
    if (!start || !end)
        return null;
    const durationSeconds = Math.round(end.diff(start, 'seconds').seconds);
    return durationSeconds >= 0 ? durationSeconds : null;
};
export const toSessionDate = (sessionDate) => {
    const text = toScalarString(sessionDate);
    if (!text)
        return null;
    const iso = DateTime.fromISO(text, { zone: 'utc' });
    if (iso.isValid)
        return iso.toISODate();
    if (/^\d{4}-\d{2}-\d{2}$/.test(text.slice(0, 10)))
        return text.slice(0, 10);
    return null;
};
//# sourceMappingURL=statsports.js.map