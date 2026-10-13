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
import Activity from '#models_pg/activity';
import Club from '#models_pg/club';
import DisplayVariable from '#models_pg/display_variable';
export default class ActivityDisplayVariable extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], ActivityDisplayVariable.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], ActivityDisplayVariable.prototype, "activityId", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], ActivityDisplayVariable.prototype, "displayVariableId", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ActivityDisplayVariable.prototype, "clubId", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ActivityDisplayVariable.prototype, "unit", void 0);
__decorate([
    belongsTo(() => Activity),
    __metadata("design:type", Object)
], ActivityDisplayVariable.prototype, "activity", void 0);
__decorate([
    belongsTo(() => Club),
    __metadata("design:type", Object)
], ActivityDisplayVariable.prototype, "club", void 0);
__decorate([
    belongsTo(() => DisplayVariable),
    __metadata("design:type", Object)
], ActivityDisplayVariable.prototype, "displayVariable", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], ActivityDisplayVariable.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], ActivityDisplayVariable.prototype, "updatedAt", void 0);
//# sourceMappingURL=activity_display_variable.js.map