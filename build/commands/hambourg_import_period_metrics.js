var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { STATSSPORTS_PERIOD_METRICS_FILE } from '#constants/hambourg.constants';
import { METRIC_AGGREGATION_METHOD, METRIC_DATA_TYPE, } from '#constants/metrics.constants';
import PeriodMetric from '#models_pg/period_metric';
import { BaseCommand, flags } from '@adonisjs/core/ace';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
function parseCsvLine(line, delimiter) {
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
        if (char === delimiter && !inQuotes) {
            cells.push(current.trim());
            current = '';
            continue;
        }
        current += char;
    }
    cells.push(current.trim());
    return cells;
}
function parseDataType(value) {
    const normalized = value.trim().toLowerCase();
    return Object.values(METRIC_DATA_TYPE).includes(normalized)
        ? normalized
        : null;
}
function parseAggregationMethod(value) {
    const normalized = value.trim().toLowerCase();
    return Object.values(METRIC_AGGREGATION_METHOD).includes(normalized)
        ? normalized
        : null;
}
function parsePeriodMetricsCsv(filePath) {
    const content = readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
    const lines = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    if (lines.length < 2)
        return [];
    const header = parseCsvLine(lines[0], ';').map((cell) => cell.toLowerCase());
    const indexOf = (name) => header.indexOf(name);
    const idIdx = indexOf('metric_id');
    const nameIdx = indexOf('name');
    const descriptionIdx = indexOf('description');
    const dataTypeIdx = indexOf('data_type');
    const aggregationIdx = indexOf('aggregation_method');
    if (idIdx < 0 || dataTypeIdx < 0 || aggregationIdx < 0) {
        throw new Error('CSV must include metric_id, data_type and aggregation_method');
    }
    const rows = [];
    for (const line of lines.slice(1)) {
        const cells = parseCsvLine(line, ';');
        const id = (cells[idIdx] ?? '').trim();
        const dataType = parseDataType(cells[dataTypeIdx] ?? '');
        const aggregationMethod = parseAggregationMethod(cells[aggregationIdx] ?? '');
        if (!id || !dataType || !aggregationMethod)
            continue;
        const description = (cells[descriptionIdx] ?? '').trim();
        rows.push({
            id,
            name: (cells[nameIdx] ?? '').trim(),
            description: description.length > 0 ? description : null,
            dataType,
            aggregationMethod,
        });
    }
    return rows;
}
export default class HambourgImportPeriodMetrics extends BaseCommand {
    static commandName = 'hambourg:import-period-metrics';
    static description = 'Update period_metrics description/dataType/aggregationMethod from statsports_period_metrics_db.csv';
    static options = {
        startApp: true,
    };
    async run() {
        const filePath = this.file.startsWith('/')
            ? this.file
            : join(process.cwd(), this.file.replace(/^\.\//, ''));
        const rows = parsePeriodMetricsCsv(filePath);
        const metrics = await PeriodMetric.query().whereIn('id', rows.map((row) => row.id));
        const metricById = new Map(metrics.map((metric) => [metric.id, metric]));
        let descriptionUpdated = 0;
        let dataTypeUpdated = 0;
        let aggregationUpdated = 0;
        let unchanged = 0;
        let missing = 0;
        const samples = [];
        const missingIds = [];
        for (const row of rows) {
            const metric = metricById.get(row.id);
            if (!metric) {
                missing++;
                missingIds.push(`${row.name || '—'} ${row.id}`);
                continue;
            }
            const updates = {};
            if (metric.description !== row.description) {
                updates.description = row.description;
                descriptionUpdated++;
            }
            if (metric.dataType !== row.dataType) {
                updates.dataType = row.dataType;
                dataTypeUpdated++;
            }
            if (metric.aggregationMethod !== row.aggregationMethod) {
                updates.aggregationMethod = row.aggregationMethod;
                aggregationUpdated++;
            }
            if (Object.keys(updates).length === 0) {
                unchanged++;
                continue;
            }
            if (samples.length < this.show) {
                samples.push(`${metric.name}: desc=${row.description ?? '—'} type=${metric.dataType}→${row.dataType} agg=${metric.aggregationMethod ?? '—'}→${row.aggregationMethod}`);
            }
            if (!this.dryRun) {
                metric.merge(updates);
                await metric.save();
            }
        }
        console.log('');
        console.log(`Period metrics CSV: ${filePath}${this.dryRun ? ' (dry-run)' : ''}`);
        console.log(`Rows: ${rows.length}`);
        console.log(`Matched period_metrics: ${metrics.length}`);
        console.log(`Missing metrics: ${missing}`);
        console.log(`Updated: description=${descriptionUpdated} dataType=${dataTypeUpdated} aggregationMethod=${aggregationUpdated} unchanged=${unchanged}`);
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
            this.logger.info(`Dry run: would update description=${descriptionUpdated} dataType=${dataTypeUpdated} aggregationMethod=${aggregationUpdated}`);
        }
        else {
            this.logger.success(`Updated description=${descriptionUpdated} dataType=${dataTypeUpdated} aggregationMethod=${aggregationUpdated}`);
        }
    }
}
__decorate([
    flags.string({
        description: 'Path to period metrics CSV',
        default: STATSSPORTS_PERIOD_METRICS_FILE,
    }),
    __metadata("design:type", String)
], HambourgImportPeriodMetrics.prototype, "file", void 0);
__decorate([
    flags.boolean({
        description: 'Preview updates without writing',
    }),
    __metadata("design:type", Boolean)
], HambourgImportPeriodMetrics.prototype, "dryRun", void 0);
__decorate([
    flags.number({
        description: 'Number of sample updates to print',
        default: 20,
    }),
    __metadata("design:type", Number)
], HambourgImportPeriodMetrics.prototype, "show", void 0);
//# sourceMappingURL=hambourg_import_period_metrics.js.map