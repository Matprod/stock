import { DateTime, Info } from 'luxon';
const normalize = (value) => value.normalize('NFD').replace(/\p{M}/gu, '').replace(/\./g, '').toLowerCase();
const MONTH_NAMES = (() => {
    const byName = new Map();
    for (const locale of ['en', 'fr']) {
        for (const format of ['long', 'short']) {
            Info.months(format, { locale }).forEach((name, index) => {
                const key = normalize(name);
                if (key.length >= 3)
                    byName.set(key, index + 1);
            });
        }
    }
    return [...byName.entries()]
        .map(([name, month]) => ({ name, month }))
        .sort((a, b) => b.name.length - a.name.length);
})();
const MONTH_ALT = MONTH_NAMES.map(({ name }) => name).join('|');
const monthRange = (year, month) => {
    const from = DateTime.utc(year, month, 1).startOf('month');
    const to = from.endOf('month');
    return { from: from.toISODate(), to: to.toISODate() };
};
const spanMonths = (fromYear, fromMonth, toYear, toMonth) => {
    let startYear = fromYear;
    let endYear = toYear;
    if (startYear === endYear && fromMonth > toMonth) {
        startYear -= 1;
    }
    const start = DateTime.utc(startYear, fromMonth, 1).startOf('month');
    let end = DateTime.utc(endYear, toMonth, 1).endOf('month');
    if (end < start) {
        end = DateTime.utc(startYear + 1, toMonth, 1).endOf('month');
    }
    return { from: start.toISODate(), to: end.toISODate() };
};
const yearNear = (text, start, end, fallbackYear) => {
    const window = text.slice(Math.max(0, start - 14), Math.min(text.length, end + 14));
    const match = window.match(/\b(20\d{2})\b/);
    return match ? Number(match[1]) : fallbackYear;
};
export const inferDateRangeFromPrompt = (prompt, fallback) => {
    const text = normalize(prompt);
    if (!text.trim())
        return null;
    const isoMonth = text.match(/\b(20\d{2})[-/.](\d{1,2})\b/);
    if (isoMonth) {
        const year = Number(isoMonth[1]);
        const month = Number(isoMonth[2]);
        if (month >= 1 && month <= 12) {
            const isoSpan = text.match(/\b(20\d{2})[-/.](\d{1,2})\b\s*(?:a|au|to|until|through|-|–|—)\s*\b(20\d{2})[-/.](\d{1,2})\b/);
            if (isoSpan) {
                const fromYear = Number(isoSpan[1]);
                const fromMonth = Number(isoSpan[2]);
                const toYear = Number(isoSpan[3]);
                const toMonth = Number(isoSpan[4]);
                if (fromMonth >= 1 &&
                    fromMonth <= 12 &&
                    toMonth >= 1 &&
                    toMonth <= 12) {
                    return spanMonths(fromYear, fromMonth, toYear, toMonth);
                }
            }
            return monthRange(year, month);
        }
    }
    const slashMonth = text.match(/\b(\d{1,2})[-/.](20\d{2})\b/);
    if (slashMonth) {
        const month = Number(slashMonth[1]);
        const year = Number(slashMonth[2]);
        if (month >= 1 && month <= 12)
            return monthRange(year, month);
    }
    const fallbackYear = Number(fallback.to.slice(0, 4));
    if (!Number.isFinite(fallbackYear))
        return null;
    const rangeRe = new RegExp(`\\b(${MONTH_ALT})\\b(?:\\s*(20\\d{2}))?\\s*(?:a|au|aux|to|until|through|jusqu\\s*a|-|–|—)\\s*\\b(${MONTH_ALT})\\b(?:\\s*(20\\d{2}))?`, 'i');
    const ranged = text.match(rangeRe);
    if (ranged) {
        const fromEntry = MONTH_NAMES.find((entry) => entry.name === normalize(ranged[1]));
        const toEntry = MONTH_NAMES.find((entry) => entry.name === normalize(ranged[3]));
        if (fromEntry && toEntry) {
            const explicitFromYear = ranged[2] ? Number(ranged[2]) : null;
            const explicitToYear = ranged[4] ? Number(ranged[4]) : null;
            const fromYear = explicitFromYear ?? explicitToYear ?? fallbackYear;
            const toYear = explicitToYear ?? explicitFromYear ?? fallbackYear;
            return spanMonths(fromYear, fromEntry.month, toYear, toEntry.month);
        }
    }
    for (const { name, month } of MONTH_NAMES) {
        const match = text.match(new RegExp(`\\b${name}\\b`));
        if (!match || match.index == null)
            continue;
        const year = yearNear(text, match.index, match.index + name.length, fallbackYear);
        return monthRange(year, month);
    }
    return null;
};
//# sourceMappingURL=infer_date_range.js.map