import { DateTime } from 'luxon';
export function bilingualName(row, enKey = 'name_en', frKey = 'name_fr') {
    const en = row[enKey];
    const fr = row[frKey];
    return en || fr || '';
}
export function mapGender(gender) {
    return gender === 'Female' ? 'female' : 'male';
}
function isValidDate(date) {
    return !Number.isNaN(date.getTime());
}
export function toDate(value) {
    if (value === null || value === undefined)
        return null;
    if (value instanceof Date) {
        return isValidDate(value) ? DateTime.fromJSDate(value).toISODate() : null;
    }
    const str = String(value).trim();
    if (!str || str.startsWith('0000-00-00'))
        return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        return str.slice(0, 10);
    }
    const fromIso = DateTime.fromISO(str, { setZone: true });
    if (fromIso.isValid)
        return fromIso.toISODate();
    const fromSql = DateTime.fromSQL(str);
    if (fromSql.isValid)
        return fromSql.toISODate();
    const fromJs = DateTime.fromJSDate(new Date(str));
    if (fromJs.isValid)
        return fromJs.toISODate();
    return null;
}
export function toTimestamp(value) {
    if (value === null || value === undefined)
        return null;
    if (value instanceof Date) {
        return isValidDate(value) ? value : null;
    }
    const str = String(value).trim();
    if (!str || str.startsWith('0000-00-00'))
        return null;
    const fromIso = DateTime.fromISO(str, { setZone: true });
    if (fromIso.isValid)
        return fromIso.toJSDate();
    const fromSql = DateTime.fromSQL(str);
    if (fromSql.isValid)
        return fromSql.toJSDate();
    const jsDate = new Date(str);
    if (isValidDate(jsDate) && DateTime.fromJSDate(jsDate).isValid) {
        return jsDate;
    }
    return null;
}
export function timestamps(row, options = {}) {
    const now = new Date();
    const createdKeys = options.createdKeys ?? ['created_at'];
    const updatedKeys = options.updatedKeys ?? ['updated_at', ...createdKeys];
    const pick = (keys) => {
        for (const key of keys) {
            const ts = toTimestamp(row[key]);
            if (ts)
                return ts;
        }
        return null;
    };
    const created_at = pick(createdKeys) ?? now;
    const updated_at = pick(updatedKeys) ?? created_at;
    return {
        created_at: isValidDate(created_at) ? created_at : now,
        updated_at: isValidDate(updated_at) ? updated_at : created_at,
    };
}
export function durationMicrosToSeconds(duration) {
    if (duration === null || duration === undefined)
        return null;
    return Math.round(duration / 1_000_000);
}
export function extractTime(value) {
    if (value === null || value === undefined)
        return null;
    const str = String(value);
    if (/^\d{2}:\d{2}:\d{2}/.test(str))
        return str.slice(0, 8);
    const match = str.match(/(\d{2}:\d{2}:\d{2})/);
    return match ? match[1] : null;
}
export function toFloat(value) {
    if (value === null || value === undefined)
        return null;
    const n = Number.parseFloat(String(value));
    return Number.isNaN(n) ? null : n;
}
export const toDecimal = toFloat;
export function toInt(value) {
    if (value === null || value === undefined)
        return null;
    const n = Number.parseFloat(String(value));
    if (Number.isNaN(n))
        return null;
    return Math.round(n);
}
export function minutesToSeconds(value) {
    const minutes = toInt(value);
    if (minutes === null)
        return null;
    return Math.round(minutes * 60);
}
export function toBool(value) {
    return value === true || value === 1 || value === '1';
}
export function toJson(value) {
    if (value === null || value === undefined)
        return null;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        }
        catch {
            return null;
        }
    }
    if (Buffer.isBuffer(value)) {
        try {
            return JSON.parse(value.toString('utf8'));
        }
        catch {
            return null;
        }
    }
    return value;
}
function toPgEnum(value, fallback, allowed) {
    const normalized = String(value ?? fallback)
        .trim()
        .toLowerCase();
    return allowed.includes(normalized) ? normalized : fallback;
}
export function toLowerEnum(value, fallback = '') {
    return String(value ?? fallback)
        .trim()
        .toLowerCase();
}
export function timeValueToSeconds(value) {
    const asInt = toInt(value);
    if (asInt !== null && !String(value).includes(':'))
        return asInt;
    const str = String(value ?? '');
    const match = str.match(/^(\d{1,2}):(\d{2}):(\d{2})/);
    if (!match)
        return null;
    return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}
export function secondsToTime(value) {
    const seconds = toInt(value);
    if (seconds === null)
        return null;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
export function mapMetricDataType(value) {
    return toPgEnum(value, 'float', ['float', 'integer', 'string', 'boolean']);
}
export function mapAggregationMethod(value) {
    return toPgEnum(value, 'average', ['sum', 'average', 'max', 'min']);
}
export function mapSerieDataType(value) {
    return toPgEnum(value, 'unsigned', ['unsigned', 'float', 'signed']);
}
//# sourceMappingURL=utils.js.map