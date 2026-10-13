var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { HAMBOURG_CLUB_ID, TRANSFERMARKET_FILE } from '#constants/hambourg.constants';
import Athlete from '#models_pg/athlete';
import { BaseCommand, flags } from '@adonisjs/core/ace';
import { DateTime } from 'luxon';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
function parseDate(value) {
    const text = value.trim();
    if (!text)
        return null;
    const parsed = DateTime.fromISO(text, { zone: 'utc' });
    return parsed.isValid ? parsed.startOf('day') : null;
}
function sameDate(current, next) {
    if (!current && !next)
        return true;
    if (!current || !next)
        return false;
    return current.toISODate() === next.toISODate();
}
function parseTransfermarketCsv(filePath) {
    const content = readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
    const lines = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    if (lines.length < 2)
        return [];
    const header = parseCsvLine(lines[0]);
    const indexOf = (name) => header.indexOf(name);
    const playerNameIdx = indexOf('player_name');
    const athleteIdIdx = indexOf('athlete_id');
    const arriveeIdx = indexOf('tm_arrivee_hsv');
    const departIdx = indexOf('tm_depart_hsv');
    if (athleteIdIdx < 0 || arriveeIdx < 0 || departIdx < 0) {
        throw new Error('CSV must include athlete_id, tm_arrivee_hsv and tm_depart_hsv');
    }
    const rows = [];
    for (const line of lines.slice(1)) {
        const cells = parseCsvLine(line);
        const athleteId = (cells[athleteIdIdx] ?? '').trim();
        const startDate = parseDate(cells[arriveeIdx] ?? '');
        if (!athleteId || !startDate)
            continue;
        rows.push({
            playerName: (cells[playerNameIdx] ?? '').trim(),
            athleteId,
            startDate,
            endDate: parseDate(cells[departIdx] ?? ''),
        });
    }
    return rows;
}
export default class HambourgImportTransfermarket extends BaseCommand {
    static commandName = 'hambourg:import-transfermarket';
    static description = 'Update Hamburg athletes startDate/endDate from hambourg/transfermarket.csv';
    static options = {
        startApp: true,
    };
    async run() {
        const filePath = this.file.startsWith('/')
            ? this.file
            : join(process.cwd(), this.file.replace(/^\.\//, ''));
        const rows = parseTransfermarketCsv(filePath);
        const athletes = await Athlete.query()
            .where('clubId', HAMBOURG_CLUB_ID)
            .whereIn('id', rows.map((row) => row.athleteId));
        const athleteById = new Map(athletes.map((athlete) => [athlete.id, athlete]));
        let startUpdated = 0;
        let endUpdated = 0;
        let unchanged = 0;
        let missing = 0;
        const samples = [];
        const missingIds = [];
        for (const row of rows) {
            const athlete = athleteById.get(row.athleteId);
            if (!athlete) {
                missing++;
                missingIds.push(`${row.playerName} ${row.athleteId}`);
                continue;
            }
            const updates = {};
            if (!sameDate(athlete.startDate, row.startDate)) {
                updates.startDate = row.startDate;
                startUpdated++;
            }
            if (!sameDate(athlete.endDate, row.endDate)) {
                updates.endDate = row.endDate;
                endUpdated++;
            }
            if (Object.keys(updates).length === 0) {
                unchanged++;
                continue;
            }
            if (samples.length < this.show) {
                samples.push(`${athlete.firstName} ${athlete.lastName}: ${athlete.startDate?.toISODate() ?? '—'} → ${row.startDate.toISODate()} | ${athlete.endDate?.toISODate() ?? '—'} → ${row.endDate?.toISODate() ?? '—'}`);
            }
            if (!this.dryRun) {
                athlete.merge(updates);
                await athlete.save();
            }
        }
        console.log('');
        console.log(`Transfermarkt CSV: ${filePath}${this.dryRun ? ' (dry-run)' : ''}`);
        console.log(`Rows: ${rows.length}`);
        console.log(`Matched Hamburg athletes: ${athletes.length}`);
        console.log(`Missing athletes: ${missing}`);
        console.log(`Updated: startDate=${startUpdated} endDate=${endUpdated} unchanged=${unchanged}`);
        if (samples.length > 0) {
            console.log('');
            console.log(`Samples (showing ${samples.length})`);
            for (const sample of samples) {
                console.log(`  - ${sample}`);
            }
        }
        if (missingIds.length > 0) {
            console.log('');
            console.log(`Missing (showing ${Math.min(this.show, missingIds.length)}/${missingIds.length})`);
            for (const row of missingIds.slice(0, this.show)) {
                console.log(`  - ${row}`);
            }
        }
        console.log('');
        if (this.dryRun) {
            this.logger.info(`Dry run: would update startDate=${startUpdated} endDate=${endUpdated}`);
        }
        else {
            this.logger.success(`Updated startDate=${startUpdated} endDate=${endUpdated}`);
        }
    }
}
__decorate([
    flags.string({
        description: 'Path to transfermarket CSV',
        default: TRANSFERMARKET_FILE,
    }),
    __metadata("design:type", String)
], HambourgImportTransfermarket.prototype, "file", void 0);
__decorate([
    flags.boolean({
        description: 'Preview updates without writing',
    }),
    __metadata("design:type", Boolean)
], HambourgImportTransfermarket.prototype, "dryRun", void 0);
__decorate([
    flags.number({
        description: 'Number of sample updates to print',
        default: 20,
    }),
    __metadata("design:type", Number)
], HambourgImportTransfermarket.prototype, "show", void 0);
//# sourceMappingURL=hambourg_import_transfermarket.js.map