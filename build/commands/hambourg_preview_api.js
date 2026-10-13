var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { TestHambourgService } from '#services/test_hambourg_service';
import { splitApiRow, transformExcelRowToApiRow } from '#services/hambourg/fbl_mapping';
import { BaseCommand, flags } from '@adonisjs/core/ace';
export default class HambourgPreviewApi extends BaseCommand {
    static commandName = 'hambourg:preview-api';
    static description = 'Preview Excel rows transformed to API naming';
    static options = {
        startApp: false,
    };
    async run() {
        const { rows } = await new TestHambourgService().previewRows(this.limit);
        rows.forEach((excelRow, index) => {
            const apiRow = transformExcelRowToApiRow(excelRow);
            const { periodMetrics, context } = splitApiRow(apiRow);
            console.log(`\n── Row ${index + 1} — context (${Object.keys(context).length} fields)`);
            console.log(context);
            const metricPreview = Object.fromEntries(Object.entries(periodMetrics).slice(0, 8));
            console.log(`\n── Row ${index + 1} — period metrics sample (8/${Object.keys(periodMetrics).length})`);
            console.log(metricPreview);
        });
    }
}
__decorate([
    flags.number({ description: 'Number of rows to preview', default: 3 }),
    __metadata("design:type", Number)
], HambourgPreviewApi.prototype, "limit", void 0);
//# sourceMappingURL=hambourg_preview_api.js.map