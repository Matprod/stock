var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ATHLETE_PROVIDER_TYPES } from '#constants/athlete_provider.constants';
import { CK_TESTS_FILE, CK_TESTS_SHEET, HAMBOURG_CLUB_ID } from '#constants/hambourg.constants';
import AthleteProvider from '#models_pg/athlete_provider';
import BiomarkerType from '#models_pg/biomarker_type';
import { BaseCommand, flags } from '@adonisjs/core/ace';
import db from '@adonisjs/lucid/services/db';
import ExcelJS from 'exceljs';
import { DateTime } from 'luxon';
const CK_BIOMARKER_NAME = 'ck';
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
    const dmy = text.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
    if (dmy) {
        const day = Number(dmy[1]);
        const month = Number(dmy[2]);
        let year = Number(dmy[3]);
        if (year < 100)
            year += 2000;
        const parsed = DateTime.fromObject({ year, month, day }, { zone: 'utc' });
        return parsed.isValid ? parsed.startOf('day') : null;
    }
    return null;
}
function valueToString(value) {
    if (value === null || value === undefined || value === '')
        return null;
    if (typeof value === 'number') {
        if (!Number.isFinite(value))
            return null;
        return String(value);
    }
    const text = String(value).trim();
    return text.length > 0 ? text : null;
}
function isNumericZero(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed === 0;
}
function preferBiomarkerValue(current, incoming) {
    if (current === undefined)
        return incoming;
    if (isNumericZero(current) && !isNumericZero(incoming))
        return incoming;
    if (!isNumericZero(current) && isNumericZero(incoming))
        return current;
    return incoming;
}
function normalizeHeader(value) {
    return value.replace(/\s+/g, ' ').trim().toLowerCase();
}
function isCkSheet(headers) {
    const normalized = headers.map(normalizeHeader);
    return (normalized.includes('personid') &&
        normalized.some((h) => h === 'ck- wert' || h === 'ck-wert'));
}
function findColumnIndex(headers, matcher) {
    return headers.findIndex((h) => matcher(normalizeHeader(h)));
}
function cacheKey(athleteId, typeId, measuredAtIso) {
    return `${athleteId}|${typeId}|${measuredAtIso}`;
}
export default class HambourgImportCkTests extends BaseCommand {
    static commandName = 'hambourg:import-ck-tests';
    static description = 'Import CK biomarkers from ck_tests.xlsx (CK sheet, PersonId → athlete, CK-Wert → ck)';
    static options = {
        startApp: true,
    };
    async run() {
        const ckType = await BiomarkerType.findBy('name', CK_BIOMARKER_NAME);
        if (!ckType) {
            this.logger.error(`Missing biomarker type "${CK_BIOMARKER_NAME}". Run: node ace hambourg:seed-biomarker-types`);
            this.exitCode = 1;
            return;
        }
        const providers = await AthleteProvider.query()
            .where('provider', ATHLETE_PROVIDER_TYPES.SAP)
            .whereNotNull('providerAthleteId')
            .preload('athlete', (q) => q.where('clubId', HAMBOURG_CLUB_ID));
        const athleteByPersonId = new Map();
        for (const provider of providers) {
            if (!provider.providerAthleteId || !provider.athlete)
                continue;
            athleteByPersonId.set(provider.providerAthleteId.trim().toUpperCase(), provider.athlete.id);
        }
        this.logger.info(`SAP athletes loaded: ${athleteByPersonId.size}`);
        const pendingByKey = new Map();
        let skippedNoPerson = 0;
        let skippedNoCk = 0;
        let skippedNoDate = 0;
        let skippedNoAthlete = 0;
        let rowsScanned = 0;
        const missingAthleteIds = new Set();
        let sheetFound = false;
        const reader = new ExcelJS.stream.xlsx.WorkbookReader(this.file, {
            worksheets: 'emit',
            sharedStrings: 'cache',
            hyperlinks: 'ignore',
            styles: 'ignore',
        });
        for await (const worksheet of reader) {
            const worksheetMeta = worksheet;
            let headers = [];
            let personCol = -1;
            let ckCol = -1;
            let dateCol = -1;
            let isTargetSheet = false;
            for await (const row of worksheet) {
                const vals = row.values?.slice(1) ?? [];
                if (row.number === 1) {
                    headers = vals.map((v) => String(cellToPlain(v) ?? '').trim());
                    isTargetSheet =
                        worksheetMeta.name === CK_TESTS_SHEET ||
                            worksheetMeta.id === '2' ||
                            isCkSheet(headers);
                    if (!isTargetSheet)
                        break;
                    sheetFound = true;
                    personCol = headers.findIndex((h) => normalizeHeader(h) === 'personid');
                    ckCol = findColumnIndex(headers, (h) => h === 'ck- wert' || h === 'ck-wert');
                    dateCol = headers.findIndex((h) => normalizeHeader(h) === 'datum');
                    if (personCol < 0 || ckCol < 0 || dateCol < 0) {
                        this.logger.error(`Sheet "${worksheetMeta.name}" missing required columns (Datum, CK-Wert, PersonId)`);
                        this.exitCode = 1;
                        return;
                    }
                    this.logger.info(`Reading sheet "${worksheetMeta.name}"`);
                    continue;
                }
                if (!isTargetSheet)
                    continue;
                if (this.limit > 0 && rowsScanned >= this.limit)
                    break;
                rowsScanned++;
                const personRaw = cellToPlain(vals[personCol]);
                if (personRaw === null || personRaw === '') {
                    skippedNoPerson++;
                    continue;
                }
                const ckRaw = valueToString(cellToPlain(vals[ckCol]));
                if (ckRaw === null) {
                    skippedNoCk++;
                    continue;
                }
                const measuredAt = parseDateValue(cellToPlain(vals[dateCol]));
                if (!measuredAt) {
                    skippedNoDate++;
                    continue;
                }
                const personId = String(personRaw).trim().toUpperCase();
                const athleteId = athleteByPersonId.get(personId);
                if (!athleteId) {
                    skippedNoAthlete++;
                    missingAthleteIds.add(personId);
                    continue;
                }
                const measuredAtIso = measuredAt.toUTC().toISO();
                const key = cacheKey(athleteId, ckType.id, measuredAtIso);
                const existing = pendingByKey.get(key);
                pendingByKey.set(key, {
                    athleteId,
                    biomarkerTypeId: ckType.id,
                    value: preferBiomarkerValue(existing?.value, ckRaw),
                    measuredAt: measuredAtIso,
                });
            }
            if (isTargetSheet)
                break;
        }
        if (!sheetFound) {
            this.logger.error(`CK sheet not found in ${this.file}`);
            this.exitCode = 1;
            return;
        }
        this.logger.info(`Rows scanned: ${rowsScanned}, unique CK values: ${pendingByKey.size}`);
        this.logger.info(`Skipped: noPersonId=${skippedNoPerson}, noCkWert=${skippedNoCk}, noDate=${skippedNoDate}, noAthlete=${skippedNoAthlete}`);
        if (this.dryRun) {
            this.logger.info(`Dry run — would upsert ${pendingByKey.size} CK biomarker values`);
            if (missingAthleteIds.size > 0) {
                this.logger.warning(`Missing SAP athletes (${missingAthleteIds.size}): ${[...missingAthleteIds].slice(0, 15).join(', ')}`);
            }
            return;
        }
        const athleteIds = [...new Set([...pendingByKey.values()].map((v) => v.athleteId))];
        const measuredAts = [...new Set([...pendingByKey.values()].map((v) => v.measuredAt))];
        this.logger.info('Loading existing CK biomarkers…');
        const existingRows = await db
            .from('biomarkers')
            .select('id', 'athlete_id', 'biomarker_type_id', 'value', 'measured_at')
            .whereIn('athlete_id', athleteIds)
            .where('biomarker_type_id', ckType.id)
            .whereIn('measured_at', measuredAts.map((iso) => DateTime.fromISO(iso, { zone: 'utc' }).toSQL()));
        const existingByKey = new Map();
        for (const row of existingRows) {
            const measuredAtIso = DateTime.fromJSDate(new Date(row.measured_at), { zone: 'utc' })
                .startOf('day')
                .toUTC()
                .toISO();
            existingByKey.set(cacheKey(row.athlete_id, row.biomarker_type_id, measuredAtIso), {
                id: row.id,
                value: row.value,
            });
        }
        const toCreate = [];
        const toUpdate = [];
        let unchanged = 0;
        for (const [, pending] of pendingByKey) {
            const key = cacheKey(pending.athleteId, pending.biomarkerTypeId, pending.measuredAt);
            const existing = existingByKey.get(key);
            if (existing) {
                const merged = preferBiomarkerValue(existing.value, pending.value);
                if (merged !== existing.value) {
                    toUpdate.push({ id: existing.id, value: merged });
                }
                else {
                    unchanged++;
                }
                continue;
            }
            toCreate.push({
                athlete_id: pending.athleteId,
                biomarker_type_id: pending.biomarkerTypeId,
                value: pending.value,
                measured_at: pending.measuredAt,
            });
        }
        this.logger.info(`Will create=${toCreate.length}, update=${toUpdate.length}, unchanged=${unchanged}`);
        const batchSize = 1000;
        for (let i = 0; i < toCreate.length; i += batchSize) {
            const batch = toCreate.slice(i, i + batchSize);
            await db.table('biomarkers').insert(batch);
            this.logger.info(`Created ${Math.min(i + batchSize, toCreate.length)}/${toCreate.length}`);
        }
        for (let i = 0; i < toUpdate.length; i += batchSize) {
            const batch = toUpdate.slice(i, i + batchSize);
            await db.transaction(async (trx) => {
                for (const item of batch) {
                    await trx.from('biomarkers').where('id', item.id).update({
                        value: item.value,
                        updated_at: DateTime.utc().toSQL(),
                    });
                }
            });
            this.logger.info(`Updated ${Math.min(i + batchSize, toUpdate.length)}/${toUpdate.length}`);
        }
        if (missingAthleteIds.size > 0) {
            this.logger.warning(`Missing SAP athletes (${missingAthleteIds.size}): ${[...missingAthleteIds].slice(0, 15).join(', ')}`);
        }
        this.logger.success('CK tests import done');
    }
}
__decorate([
    flags.string({ description: 'Path to ck_tests xlsx', default: CK_TESTS_FILE }),
    __metadata("design:type", String)
], HambourgImportCkTests.prototype, "file", void 0);
__decorate([
    flags.boolean({ description: 'Parse only, do not write biomarkers' }),
    __metadata("design:type", Boolean)
], HambourgImportCkTests.prototype, "dryRun", void 0);
__decorate([
    flags.number({ description: 'Max rows to process (0 = all)', default: 0 }),
    __metadata("design:type", Number)
], HambourgImportCkTests.prototype, "limit", void 0);
//# sourceMappingURL=hambourg_import_ck_tests.js.map