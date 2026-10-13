import { GENDER } from '#constants/athlete.constants';
import { DIAGNOSTIK_FILE, DIAGNOSTIK_SHEET } from '#constants/hambourg.constants';
import ExcelJS from 'exceljs';
import { DateTime } from 'luxon';
import { readFileSync } from 'node:fs';
function parseCsvLine(line) {
    const cells = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            }
            else {
                inQuotes = !inQuotes;
            }
            continue;
        }
        if (char === ',' && !inQuotes) {
            cells.push(current.trim());
            current = '';
            continue;
        }
        current += char;
    }
    cells.push(current.trim());
    return cells;
}
function parseBirthday(value) {
    const text = value.trim();
    if (!text)
        return null;
    const parsed = DateTime.fromISO(text, { zone: 'utc' });
    if (!parsed.isValid)
        return null;
    return parsed.startOf('day');
}
function parseGender(value) {
    const normalized = value.trim().toLowerCase();
    if (normalized === GENDER.MALE)
        return GENDER.MALE;
    if (normalized === GENDER.FEMALE)
        return GENDER.FEMALE;
    return null;
}
export function parseQuestPersonsCsv(filePath) {
    const content = readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
    const lines = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    if (lines.length < 2)
        return new Map();
    const header = parseCsvLine(lines[0]).map((cell) => cell.toLowerCase());
    const indexOf = (name) => header.indexOf(name);
    const personIdIdx = indexOf('personid');
    const firstNameIdx = indexOf('firstname');
    const lastNameIdx = indexOf('lastname');
    const birthdayIdx = indexOf('birthday');
    const genderIdx = indexOf('gender');
    if (personIdIdx < 0) {
        throw new Error('CSV must include a PersonId column');
    }
    const persons = new Map();
    for (const line of lines.slice(1)) {
        const cells = parseCsvLine(line);
        const personId = (cells[personIdIdx] ?? '').trim();
        if (!personId)
            continue;
        persons.set(personId.toUpperCase(), {
            personId,
            firstName: firstNameIdx >= 0 ? (cells[firstNameIdx] ?? '').trim() : '',
            lastName: lastNameIdx >= 0 ? (cells[lastNameIdx] ?? '').trim() : '',
            birthday: birthdayIdx >= 0 ? parseBirthday(cells[birthdayIdx] ?? '') : null,
            gender: genderIdx >= 0 ? parseGender(cells[genderIdx] ?? '') : null,
        });
    }
    return persons;
}
function excelSerialToDateTime(serial) {
    return DateTime.fromObject({ year: 1899, month: 12, day: 30 }, { zone: 'utc' }).plus({
        days: serial,
    });
}
function cellToPlain(value) {
    if (value === null || value === undefined)
        return null;
    if (value instanceof Date)
        return value.toISOString();
    if (typeof value === 'number' || typeof value === 'string')
        return value;
    if (typeof value === 'boolean')
        return value ? 1 : 0;
    if (typeof value === 'object') {
        if ('text' in value && typeof value.text === 'string')
            return value.text;
        if ('result' in value) {
            const result = value.result;
            if (result === null || result === undefined)
                return null;
            if (typeof result === 'number' || typeof result === 'string')
                return result;
            if (result instanceof Date)
                return result.toISOString();
            return String(result);
        }
    }
    return String(value);
}
function parseDateValue(value) {
    if (value === null || value === undefined || value === '')
        return null;
    if (value instanceof Date) {
        const parsed = DateTime.fromJSDate(value, { zone: 'utc' }).startOf('day');
        return parsed.isValid ? parsed : null;
    }
    if (typeof value === 'number') {
        const parsed = excelSerialToDateTime(value).startOf('day');
        return parsed.isValid ? parsed : null;
    }
    const text = String(value).trim();
    if (!text)
        return null;
    const fromIso = DateTime.fromISO(text, { zone: 'utc' });
    if (fromIso.isValid)
        return fromIso.startOf('day');
    const fromSql = DateTime.fromSQL(text, { zone: 'utc' });
    if (fromSql.isValid)
        return fromSql.startOf('day');
    return null;
}
export function toHeightCm(value) {
    if (value === null || value === undefined || value === '')
        return null;
    const numeric = typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'));
    if (!Number.isFinite(numeric) || numeric <= 0)
        return null;
    const cm = numeric < 3 ? numeric * 100 : numeric;
    if (cm < 120 || cm > 230)
        return null;
    return Math.round(cm);
}
export async function loadLatestHeightsFromDiagnostik(filePath = DIAGNOSTIK_FILE) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.getWorksheet(DIAGNOSTIK_SHEET) ?? workbook.worksheets[0] ?? null;
    if (!sheet)
        return new Map();
    const headerByCol = new Map();
    sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
        const header = String(cell.value ?? '').trim();
        if (header)
            headerByCol.set(col, header);
    });
    const personIdCol = [...headerByCol.entries()].find(([, header]) => header === 'PersonId')?.[0];
    const heightCol = [...headerByCol.entries()].find(([, header]) => header === 'Height')?.[0];
    const dateCol = [...headerByCol.entries()].find(([, header]) => header === 'Date')?.[0];
    if (!personIdCol || !heightCol)
        return new Map();
    const latest = new Map();
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
        const row = sheet.getRow(rowNumber);
        const personRaw = cellToPlain(row.getCell(personIdCol).value);
        if (personRaw === null || personRaw === '')
            continue;
        const heightCm = toHeightCm(cellToPlain(row.getCell(heightCol).value));
        if (heightCm === null)
            continue;
        const personId = String(personRaw).trim().toUpperCase();
        const measuredAt = dateCol ? parseDateValue(cellToPlain(row.getCell(dateCol).value)) : null;
        const dateMs = measuredAt?.toMillis() ?? 0;
        const current = latest.get(personId);
        if (!current || dateMs >= current.dateMs) {
            latest.set(personId, { dateMs, heightCm });
        }
    }
    return new Map([...latest.entries()].map(([personId, value]) => [personId, value.heightCm]));
}
//# sourceMappingURL=sap_persons.js.map