var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { DateTime } from 'luxon';
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm';
import Day from '#models/day';
export default class ChatbotReport extends BaseModel {
    static async latestForDay(dayId, category) {
        return this.query()
            .where('dayId', dayId)
            .where('category', category)
            .orderBy('createdAt', 'desc')
            .first();
    }
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], ChatbotReport.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], ChatbotReport.prototype, "dayId", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], ChatbotReport.prototype, "category", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], ChatbotReport.prototype, "reportMessage", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ChatbotReport.prototype, "summary", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ChatbotReport.prototype, "scoreAtGeneration", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], ChatbotReport.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], ChatbotReport.prototype, "updatedAt", void 0);
__decorate([
    belongsTo(() => Day),
    __metadata("design:type", Object)
], ChatbotReport.prototype, "day", void 0);
//# sourceMappingURL=chatbot_report.js.map