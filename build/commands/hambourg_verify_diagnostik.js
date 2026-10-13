import { ATHLETE_PROVIDER_TYPES } from '#constants/athlete_provider.constants';
import { DIAGNOSTIK_BIOMARKER_DEFS } from '#constants/diagnostik.constants';
import { DIAGNOSTIK_FILE, HAMBOURG_CLUB_ID } from '#constants/hambourg.constants';
import AthleteProvider from '#models_pg/athlete_provider';
import BiomarkerType from '#models_pg/biomarker_type';
import { BaseCommand } from '@adonisjs/core/ace';
import db from '@adonisjs/lucid/services/db';
import ExcelJS from 'exceljs';
import { DateTime } from 'luxon';
function cellToPlain(value) {
    if (value === null || value === undefined)
        return null;
    if (value instanceof Date)
        return value.toISOString();
    if (typeof value === 'number' || typeof value === 'string')
        return value;
    if (typeof value === 'object' && 'result' in value)
        return cellToPlain(value.result);
    return String(value);
}
function parseDate(value) {
    const plain = cellToPlain(value);
    if (!plain)
        return null;
    if (typeof plain === 'string' && plain.includes('T')) {
        return DateTime.fromISO(plain, { zone: 'utc' }).toISODate();
    }
    if (typeof plain === 'number') {
        return DateTime.fromObject({ year: 1899, month: 12, day: 30 }, { zone: 'utc' })
            .plus({ days: plain })
            .toISODate();
    }
    return null;
}
function isZero(v) {
    const n = Number(v);
    return Number.isFinite(n) && n === 0;
}
function prefer(current, incoming) {
    if (current === undefined)
        return incoming;
    if (isZero(current) && !isZero(incoming))
        return incoming;
    if (!isZero(current) && isZero(incoming))
        return current;
    return incoming;
}
function valuesEqual(a, b) {
    if (a === b)
        return true;
    const an = Number(a);
    const bn = Number(b);
    return Number.isFinite(an) && Number.isFinite(bn) && Math.abs(an - bn) < 1e-9;
}
export default class HambourgVerifyDiagnostik extends BaseCommand {
    static commandName = 'hambourg:verify-diagnostik';
    static description = 'Verify diagnostik biomarkers in DB vs Excel (prefer non-zero on duplicates)';
    static options = {
        startApp: true,
    };
    async run() {
        const providers = await AthleteProvider.query()
            .where('provider', ATHLETE_PROVIDER_TYPES.SAP)
            .whereNotNull('providerAthleteId')
            .preload('athlete', (q) => q.where('clubId', HAMBOURG_CLUB_ID));
        const athleteByPerson = new Map();
        const personByAthlete = new Map();
        for (const p of providers) {
            if (!p.providerAthleteId || !p.athlete)
                continue;
            const pid = p.providerAthleteId.trim().toUpperCase();
            athleteByPerson.set(pid, p.athlete.id);
            personByAthlete.set(p.athlete.id, pid);
        }
        const types = await BiomarkerType.query().whereIn('name', Object.values(DIAGNOSTIK_BIOMARKER_DEFS).map((d) => d.name));
        const typeIdToName = new Map(types.map((t) => [t.id, t.name]));
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(DIAGNOSTIK_FILE);
        const sheet = workbook.worksheets[0];
        const headers = new Map();
        sheet.getRow(1).eachCell((c, col) => headers.set(col, String(c.value ?? '').trim()));
        const personCol = [...headers].find(([, h]) => h === 'PersonId')[0];
        const dateCol = [...headers].find(([, h]) => h === 'Date')[0];
        const lastCol = [...headers].find(([, h]) => h === 'LastName')[0];
        const metricCols = [...headers]
            .filter(([, h]) => DIAGNOSTIK_BIOMARKER_DEFS[h])
            .map(([col, h]) => ({ col, name: DIAGNOSTIK_BIOMARKER_DEFS[h].name }));
        const expected = new Map();
        const zeroConflicts = new Set();
        for (let r = 2; r <= sheet.rowCount; r++) {
            const row = sheet.getRow(r);
            const pid = cellToPlain(row.getCell(personCol).value);
            if (!pid)
                continue;
            const personId = String(pid).trim().toUpperCase();
            const date = parseDate(row.getCell(dateCol).value);
            if (!date)
                continue;
            for (const { col, name } of metricCols) {
                const raw = cellToPlain(row.getCell(col).value);
                if (raw === null || raw === undefined || raw === '')
                    continue;
                const val = String(raw);
                const key = `${personId}|${date}|${name}`;
                const prev = expected.get(key);
                if (prev !== undefined && prev !== val && (isZero(prev) !== isZero(val))) {
                    zeroConflicts.add(key);
                }
                expected.set(key, prefer(prev, val));
            }
        }
        const athleteIds = [...athleteByPerson.values()];
        const dbRows = await db
            .from('biomarkers')
            .whereIn('athlete_id', athleteIds)
            .whereIn('biomarker_type_id', types.map((t) => t.id))
            .select('athlete_id', 'biomarker_type_id', 'value', 'measured_at');
        const dbMap = new Map();
        for (const row of dbRows) {
            const date = DateTime.fromJSDate(new Date(row.measured_at), { zone: 'utc' }).toISODate();
            const name = typeIdToName.get(row.biomarker_type_id);
            dbMap.set(`${row.athlete_id}|${date}|${name}`, String(row.value));
        }
        let ok = 0;
        let zeroBugs = 0;
        let otherMismatches = 0;
        let missing = 0;
        let conflictOk = 0;
        for (const key of zeroConflicts) {
            const [personId, date, name] = key.split('|');
            const athleteId = athleteByPerson.get(personId);
            if (!athleteId)
                continue;
            const exp = expected.get(key);
            const dbVal = dbMap.get(`${athleteId}|${date}|${name}`);
            if (dbVal && valuesEqual(exp, dbVal) && !isZero(dbVal))
                conflictOk++;
            else if (dbVal && isZero(dbVal) && !isZero(exp))
                zeroBugs++;
        }
        for (const [key, exp] of expected) {
            const [personId, date, name] = key.split('|');
            const athleteId = athleteByPerson.get(personId);
            if (!athleteId)
                continue;
            const dbVal = dbMap.get(`${athleteId}|${date}|${name}`);
            if (dbVal === undefined) {
                missing++;
                continue;
            }
            if (valuesEqual(exp, dbVal))
                ok++;
            else if (isZero(dbVal) && !isZero(exp))
                zeroBugs++;
            else
                otherMismatches++;
        }
        const examples = [
            { last: 'Suhonen', date: '2025-06-30', name: 'ffm' },
            { last: 'Schonlau', date: '2025-06-30', names: ['ffm', 'ffmi'] },
            { last: 'Sahiti', date: '2025-01-02', names: ['fms_total', 'ybal_composite_left'] },
        ];
        this.logger.info('--- Named examples ---');
        for (const ex of examples) {
            let personId = null;
            for (let r = 2; r <= sheet.rowCount; r++) {
                const last = String(cellToPlain(sheet.getRow(r).getCell(lastCol).value) ?? '');
                if (!last.toLowerCase().includes(ex.last.toLowerCase()))
                    continue;
                const pid = cellToPlain(sheet.getRow(r).getCell(personCol).value);
                if (pid) {
                    personId = String(pid).trim().toUpperCase();
                    break;
                }
            }
            const athleteId = personId ? athleteByPerson.get(personId) : null;
            for (const name of ex.names ?? [ex.name]) {
                const exp = personId ? expected.get(`${personId}|${ex.date}|${name}`) : null;
                const dbVal = athleteId ? dbMap.get(`${athleteId}|${ex.date}|${name}`) : null;
                const status = exp && dbVal && valuesEqual(exp, dbVal) && !isZero(dbVal) ? 'OK' : 'FAIL';
                this.logger.info(`  ${ex.last} ${ex.date} ${name}: excel=${exp} db=${dbVal} → ${status}`);
            }
        }
        this.logger.info('--- Summary ---');
        this.logger.info(`Expected values (with SAP athlete): ${ok + zeroBugs + otherMismatches + missing}`);
        this.logger.info(`Match: ${ok}`);
        this.logger.info(`Zero filler bugs: ${zeroBugs}`);
        this.logger.info(`Other mismatches: ${otherMismatches}`);
        this.logger.info(`Missing in DB: ${missing}`);
        this.logger.info(`0-vs-real conflict keys: ${zeroConflicts.size}, resolved OK: ${conflictOk}`);
        if (zeroBugs > 0) {
            this.exitCode = 1;
            this.logger.error('Some biomarkers still have 0 instead of real values — run: node ace hambourg:import-diagnostik');
        }
        else {
            this.logger.success('All checked diagnostik values look correct');
        }
    }
}
//# sourceMappingURL=hambourg_verify_diagnostik.js.map