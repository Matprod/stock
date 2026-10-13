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
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm';
import Event from '#models/event';
import Athlete from '#models/athlete';
export default class PlayerNote extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], PlayerNote.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], PlayerNote.prototype, "athleteId", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], PlayerNote.prototype, "eventId", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], PlayerNote.prototype, "category", void 0);
__decorate([
    column.date(),
    __metadata("design:type", DateTime)
], PlayerNote.prototype, "noteDate", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], PlayerNote.prototype, "content", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], PlayerNote.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], PlayerNote.prototype, "updatedAt", void 0);
__decorate([
    belongsTo(() => Event, { foreignKey: 'eventId' }),
    __metadata("design:type", Object)
], PlayerNote.prototype, "event", void 0);
__decorate([
    belongsTo(() => Athlete, { foreignKey: 'athleteId' }),
    __metadata("design:type", Object)
], PlayerNote.prototype, "athlete", void 0);
//# sourceMappingURL=player_note.js.map