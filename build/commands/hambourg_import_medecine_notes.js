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
import { EVENT_CATEGORY } from '#constants/event.constants';
import { HAMBOURG_CLUB_ID, MEDECINE_FILE, MEDECINE_SAP_MAPPING_FILE, } from '#constants/hambourg.constants';
import AthleteProvider from '#models_pg/athlete_provider';
import PlayerNote from '#models_pg/player_note';
import { BaseCommand, flags } from '@adonisjs/core/ace';
import { readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { DateTime } from 'luxon';
function excelSerialToDateTime(serial) {
    return DateTime.fromObject({ year: 1899, month: 12, day: 30 }, { zone: 'utc' }).plus({
        days: serial,
    });
}
function cellText(value) {
    if (value === null || value === undefined)
        return null;
    if (value instanceof Date)
        return value.toISOString();
    if (typeof value === 'number' || typeof value === 'string')
        return String(value);
    if (typeof value === 'boolean')
        return value ? '1' : '0';
    if (typeof value === 'object') {
        if ('richText' in value && Array.isArray(value.richText)) {
            return value.richText.map((part) => part.text).join('');
        }
        if ('text' in value && typeof value.text === 'string')
            return value.text;
        if ('result' in value)
            return cellText(value.result);
    }
    return String(value);
}
function isPlausibleNoteDate(date) {
    return !!date && date.isValid && date.year >= 1990 && date.year <= 2035;
}
function parseCompactDmyNumber(value) {
    if (!Number.isInteger(value) || value < 1011990 || value > 31122035)
        return null;
    const text = String(value);
    if (text.length !== 8)
        return null;
    const day = Number(text.slice(0, 2));
    const month = Number(text.slice(2, 4));
    const year = Number(text.slice(4, 8));
    const parsed = DateTime.fromObject({ year, month, day }, { zone: 'utc' }).startOf('day');
    return isPlausibleNoteDate(parsed) ? parsed : null;
}
function parseNoteDate(value) {
    if (value === null || value === undefined || value === '')
        return null;
    if (value instanceof Date) {
        const parsed = DateTime.fromJSDate(value, { zone: 'utc' }).startOf('day');
        return isPlausibleNoteDate(parsed) ? parsed : null;
    }
    if (typeof value === 'number') {
        const compact = parseCompactDmyNumber(value);
        if (compact)
            return compact;
        if (value >= 20000 && value <= 60000) {
            const parsed = excelSerialToDateTime(value).startOf('day');
            return isPlausibleNoteDate(parsed) ? parsed : null;
        }
        return null;
    }
    const text = cellText(value)?.trim();
    if (!text)
        return null;
    const iso = DateTime.fromISO(text, { zone: 'utc' });
    if (isPlausibleNoteDate(iso))
        return iso.startOf('day');
    const dmy = text.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
    if (dmy) {
        const day = Number(dmy[1]);
        const month = Number(dmy[2]);
        let year = Number(dmy[3]);
        if (year < 100)
            year += 2000;
        const parsed = DateTime.fromObject({ year, month, day }, { zone: 'utc' });
        return isPlausibleNoteDate(parsed) ? parsed.startOf('day') : null;
    }
    const range = text.match(/(\d{1,2})\.\s*(?:bis|-|\+)\s*\d{1,2}\.?(\d{0,2})\.?(\d{2,4})?/i) ||
        text.match(/(?:ab\s+)?(\d{1,2})[./](\d{1,2})[./](\d{2,4})/i) ||
        text.match(/(\d{1,2})\.-(\d{1,2})\.(\d{1,2})\.?(\d{2,4})?/);
    if (range) {
        const day = Number(range[1]);
        let month = Number(range[2] || range[3]);
        let yearRaw = range[3] || range[4];
        const alt = text.match(/(\d{1,2})\.-?\d{0,2}\.?(\d{1,2})\.(\d{2,4})/);
        if (alt) {
            const d = Number(alt[1]);
            const m = Number(alt[2]);
            let y = Number(alt[3]);
            if (y < 100)
                y += 2000;
            const parsed = DateTime.fromObject({ year: y, month: m, day: d }, { zone: 'utc' });
            if (isPlausibleNoteDate(parsed))
                return parsed.startOf('day');
        }
        if (yearRaw) {
            let year = Number(yearRaw);
            if (year < 100)
                year += 2000;
            if (!month || month > 12) {
                const m2 = text.match(/\.(\d{1,2})\.(\d{2,4})/);
                if (m2) {
                    month = Number(m2[1]);
                    year = Number(m2[2]);
                    if (year < 100)
                        year += 2000;
                }
            }
            const parsed = DateTime.fromObject({ year, month, day }, { zone: 'utc' });
            if (isPlausibleNoteDate(parsed))
                return parsed.startOf('day');
        }
    }
    return null;
}
function rowContent(row, fromCol = 2, toCol = 6) {
    const parts = [];
    for (let col = fromCol; col <= toCol; col++) {
        const raw = row.getCell(col).value;
        if (raw instanceof Date) {
            parts.push(DateTime.fromJSDate(raw, { zone: 'utc' }).toISODate() ?? '');
            continue;
        }
        const text = cellText(raw)?.trim();
        if (text)
            parts.push(text);
    }
    return parts.join(' | ').trim();
}
function loadSapMapping(path) {
    const lines = readFileSync(path, 'utf8').trim().split(/\r?\n/);
    const map = new Map();
    for (const line of lines.slice(1)) {
        if (!line.trim())
            continue;
        const [sheet, personId, lastName = '', firstName = ''] = line.split(',');
        map.set(sheet.trim(), {
            sheet: sheet.trim(),
            personId: personId?.trim() ? personId.trim().toUpperCase() : null,
            lastName: lastName.trim(),
            firstName: firstName.trim(),
        });
    }
    return map;
}
function isChronologyHeader(text) {
    return /chronologie/i.test(text);
}
function isDatumHeader(text) {
    return /^datum\s*:?\s*$/i.test(text.trim());
}
export default class HambourgImportMedecineNotes extends BaseCommand {
    static commandName = 'hambourg:import-medecine-notes';
    static description = 'Import medical notes from medecine.xlsx (sheet → SAP PersonId mapping CSV)';
    static options = {
        startApp: true,
    };
    async run() {
        const mapping = loadSapMapping(this.mapping);
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
        this.logger.info(`Mapping rows: ${mapping.size}`);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(this.file);
        const notes = [];
        const skippedNoMapping = [];
        const skippedNoPersonId = [];
        const skippedNoAthlete = [];
        const skippedNoDate = [];
        let sheetsProcessed = 0;
        for (const [index, sheet] of workbook.worksheets.entries()) {
            if (index < 2)
                continue;
            sheetsProcessed++;
            const mapRow = mapping.get(sheet.name);
            if (!mapRow) {
                skippedNoMapping.push(sheet.name);
                continue;
            }
            if (!mapRow.personId) {
                skippedNoPersonId.push(sheet.name);
                continue;
            }
            const athleteId = athleteByPersonId.get(mapRow.personId);
            if (!athleteId) {
                skippedNoAthlete.push(`${sheet.name} (${mapRow.personId})`);
                continue;
            }
            let datumRow = null;
            for (let r = 1; r <= sheet.rowCount; r++) {
                const text = cellText(sheet.getRow(r).getCell(1).value);
                if (text && isDatumHeader(text)) {
                    datumRow = r;
                    break;
                }
            }
            const chronologyNotes = [];
            let lastDate = null;
            if (datumRow) {
                for (let r = datumRow + 1; r <= sheet.rowCount; r++) {
                    const row = sheet.getRow(r);
                    const dateCell = row.getCell(1).value;
                    const labelOrDate = cellText(dateCell)?.trim() ?? '';
                    const content = rowContent(row);
                    const parsedDate = parseNoteDate(dateCell);
                    if (parsedDate) {
                        lastDate = parsedDate;
                        if (!content)
                            continue;
                        chronologyNotes.push({
                            sheet: sheet.name,
                            personId: mapRow.personId,
                            athleteId,
                            noteDate: parsedDate,
                            content,
                            source: 'chronology',
                            row: r,
                        });
                        continue;
                    }
                    if (!content && !labelOrDate)
                        continue;
                    if (!lastDate) {
                        skippedNoDate.push({
                            sheet: sheet.name,
                            row: r,
                            preview: (labelOrDate || content).slice(0, 80),
                        });
                        continue;
                    }
                    const fullContent = labelOrDate && content ? `${labelOrDate}: ${content}` : content || labelOrDate;
                    chronologyNotes.push({
                        sheet: sheet.name,
                        personId: mapRow.personId,
                        athleteId,
                        noteDate: lastDate,
                        content: fullContent,
                        source: 'chronology',
                        row: r,
                    });
                }
            }
            notes.push(...chronologyNotes);
            if (this.anamnesis) {
                const anamEnd = datumRow ? datumRow - 1 : sheet.rowCount;
                const fallbackDate = chronologyNotes[0]?.noteDate ?? DateTime.fromISO('2025-01-01', { zone: 'utc' });
                for (let r = 5; r <= anamEnd; r++) {
                    const row = sheet.getRow(r);
                    const label = cellText(row.getCell(1).value)?.trim();
                    if (!label)
                        continue;
                    if (isChronologyHeader(label) || isDatumHeader(label))
                        continue;
                    const value = rowContent(row);
                    if (!value)
                        continue;
                    notes.push({
                        sheet: sheet.name,
                        personId: mapRow.personId,
                        athleteId,
                        noteDate: fallbackDate,
                        content: `${label}: ${value}`,
                        source: 'anamnesis',
                        row: r,
                    });
                }
            }
        }
        const chronologyCount = notes.filter((n) => n.source === 'chronology').length;
        const anamnesisCount = notes.filter((n) => n.source === 'anamnesis').length;
        const athletes = new Set(notes.map((n) => n.athleteId)).size;
        this.logger.info(`Sheets processed (skip first 2): ${sheetsProcessed}`);
        this.logger.info(`Notes parsed: ${notes.length} (chronology=${chronologyCount}, anamnesis=${anamnesisCount}) across ${athletes} athletes`);
        this.logger.info(`Skipped no mapping: ${skippedNoMapping.length}`);
        this.logger.info(`Skipped no PersonId in CSV: ${skippedNoPersonId.length}`);
        if (skippedNoPersonId.length)
            this.logger.warning(skippedNoPersonId.join(', '));
        this.logger.info(`Skipped no SAP athlete: ${skippedNoAthlete.length}`);
        if (skippedNoAthlete.length)
            this.logger.warning(skippedNoAthlete.join(', '));
        this.logger.info(`Skipped no date (before first dated row): ${skippedNoDate.length}`);
        if (this.dryRun) {
            this.logger.info(`Dry-run sample (max ${this.show}):`);
            for (const note of notes.slice(0, this.show)) {
                this.logger.info(`  [${note.source}] ${note.sheet}#${note.row} ${note.noteDate.toISODate()} — ${note.content.slice(0, 100).replace(/\n/g, ' ')}`);
            }
            this.logger.info('Dry run — nothing written');
            return;
        }
        let created = 0;
        let skippedExisting = 0;
        const batchSize = 500;
        const athleteIds = [...new Set(notes.map((n) => n.athleteId))];
        const existing = await PlayerNote.query()
            .whereIn('athleteId', athleteIds)
            .where('category', EVENT_CATEGORY.MEDICAL);
        const existingKeys = new Set(existing.map((note) => `${note.athleteId}|${note.noteDate.toISODate()}|${note.content}`));
        const toCreate = [];
        for (const note of notes) {
            const key = `${note.athleteId}|${note.noteDate.toISODate()}|${note.content}`;
            if (existingKeys.has(key)) {
                skippedExisting++;
                continue;
            }
            existingKeys.add(key);
            toCreate.push({
                athleteId: note.athleteId,
                noteDate: note.noteDate,
                content: note.content,
                category: EVENT_CATEGORY.MEDICAL,
                eventId: null,
            });
        }
        for (let i = 0; i < toCreate.length; i += batchSize) {
            const batch = toCreate.slice(i, i + batchSize);
            await PlayerNote.createMany(batch);
            created += batch.length;
            this.logger.info(`Created ${Math.min(i + batchSize, toCreate.length)}/${toCreate.length}`);
        }
        this.logger.success(`Done: created=${created}, skippedExisting=${skippedExisting}`);
    }
}
__decorate([
    flags.string({ description: 'Path to medecine xlsx', default: MEDECINE_FILE }),
    __metadata("design:type", String)
], HambourgImportMedecineNotes.prototype, "file", void 0);
__decorate([
    flags.string({
        description: 'Path to sheet→SAP mapping CSV',
        default: MEDECINE_SAP_MAPPING_FILE,
    }),
    __metadata("design:type", String)
], HambourgImportMedecineNotes.prototype, "mapping", void 0);
__decorate([
    flags.boolean({ description: 'Parse and resolve athletes only, do not write' }),
    __metadata("design:type", Boolean)
], HambourgImportMedecineNotes.prototype, "dryRun", void 0);
__decorate([
    flags.boolean({
        description: 'Also import anamnesis block (Starker Fuß, Narben, …)',
        default: true,
    }),
    __metadata("design:type", Boolean)
], HambourgImportMedecineNotes.prototype, "anamnesis", void 0);
__decorate([
    flags.number({ description: 'Sample notes printed in dry-run', default: 15 }),
    __metadata("design:type", Number)
], HambourgImportMedecineNotes.prototype, "show", void 0);
//# sourceMappingURL=hambourg_import_medecine_notes.js.map