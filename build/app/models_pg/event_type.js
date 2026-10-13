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
import { BaseModel, column, belongsTo, hasMany, manyToMany } from '@adonisjs/lucid/orm';
import Activity from '#models_pg/activity';
import Club from '#models_pg/club';
import Event from '#models_pg/event';
export default class EventType extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], EventType.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], EventType.prototype, "name", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], EventType.prototype, "color", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], EventType.prototype, "icon", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], EventType.prototype, "eventCategory", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], EventType.prototype, "activityId", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], EventType.prototype, "travelType", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], EventType.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], EventType.prototype, "updatedAt", void 0);
__decorate([
    belongsTo(() => Activity),
    __metadata("design:type", Object)
], EventType.prototype, "activity", void 0);
__decorate([
    hasMany(() => Event),
    __metadata("design:type", Object)
], EventType.prototype, "events", void 0);
__decorate([
    manyToMany(() => Club, {
        pivotTable: 'event_type_clubs',
    }),
    __metadata("design:type", Object)
], EventType.prototype, "clubs", void 0);
//# sourceMappingURL=event_type.js.map