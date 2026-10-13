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
import { BaseModel, column, belongsTo, computed } from '@adonisjs/lucid/orm';
import Health from '#models/health';
import Event from '#models/event';
export default class Travel extends BaseModel {
    static table = 'health_travel';
    get durationText() {
        console.log(this.duration);
        return this.duration ? DateTime.fromMillis(this.duration / 1000).toFormat('HH:mm') : null;
    }
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], Travel.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Travel.prototype, "meanOfTransport", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], Travel.prototype, "duration", void 0);
__decorate([
    computed(),
    __metadata("design:type", Object),
    __metadata("design:paramtypes", [])
], Travel.prototype, "durationText", null);
__decorate([
    column.dateTime(),
    __metadata("design:type", DateTime)
], Travel.prototype, "dateAdded", void 0);
__decorate([
    column.dateTime(),
    __metadata("design:type", DateTime)
], Travel.prototype, "dateUpdated", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Travel.prototype, "eventId", void 0);
__decorate([
    belongsTo(() => Event, {
        foreignKey: 'eventId',
    }),
    __metadata("design:type", Object)
], Travel.prototype, "event", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], Travel.prototype, "healthId", void 0);
__decorate([
    belongsTo(() => Health),
    __metadata("design:type", Object)
], Travel.prototype, "health", void 0);
//# sourceMappingURL=travel.js.map