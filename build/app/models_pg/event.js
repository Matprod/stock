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
import EventType from '#models_pg/event_type';
import Club from '#models_pg/club';
import SportActivity from '#models_pg/sport_activity';
import Athlete from '#models_pg/athlete';
import Travel from '#models_pg/travel';
import BasketballGame from '#models_pg/basketball_game';
export default class Event extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], Event.prototype, "id", void 0);
__decorate([
    column.dateTime(),
    __metadata("design:type", DateTime)
], Event.prototype, "startTime", void 0);
__decorate([
    column.dateTime(),
    __metadata("design:type", DateTime)
], Event.prototype, "endTime", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Event.prototype, "title", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Event.prototype, "location", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Event.prototype, "eventTypeId", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Event.prototype, "clubId", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], Event.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], Event.prototype, "updatedAt", void 0);
__decorate([
    belongsTo(() => EventType),
    __metadata("design:type", Object)
], Event.prototype, "eventType", void 0);
__decorate([
    belongsTo(() => Club),
    __metadata("design:type", Object)
], Event.prototype, "club", void 0);
__decorate([
    hasMany(() => SportActivity),
    __metadata("design:type", Object)
], Event.prototype, "sportActivities", void 0);
__decorate([
    manyToMany(() => Athlete, {
        pivotTable: 'athlete_events',
        pivotForeignKey: 'event_id',
        pivotRelatedForeignKey: 'athlete_id',
    }),
    __metadata("design:type", Object)
], Event.prototype, "athletes", void 0);
__decorate([
    hasMany(() => Travel),
    __metadata("design:type", Object)
], Event.prototype, "travels", void 0);
__decorate([
    hasMany(() => BasketballGame),
    __metadata("design:type", Object)
], Event.prototype, "basketballGames", void 0);
//# sourceMappingURL=event.js.map