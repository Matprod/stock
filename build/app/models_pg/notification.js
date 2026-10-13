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
import { BaseModel, column, belongsTo, manyToMany } from '@adonisjs/lucid/orm';
import Club from '#models_pg/club';
import NotificationMessage from '#models_pg/notification_message';
import Athlete from '#models_pg/athlete';
export default class Notification extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], Notification.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Notification.prototype, "title", void 0);
__decorate([
    column.date(),
    __metadata("design:type", Object)
], Notification.prototype, "date", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Notification.prototype, "day", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Notification.prototype, "time", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Notification.prototype, "clubId", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], Notification.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], Notification.prototype, "updatedAt", void 0);
__decorate([
    belongsTo(() => Club),
    __metadata("design:type", Object)
], Notification.prototype, "club", void 0);
__decorate([
    manyToMany(() => NotificationMessage, {
        pivotTable: 'notification_message_links',
    }),
    __metadata("design:type", Object)
], Notification.prototype, "messages", void 0);
__decorate([
    manyToMany(() => Athlete, {
        pivotTable: 'notification_athletes',
    }),
    __metadata("design:type", Object)
], Notification.prototype, "athletes", void 0);
//# sourceMappingURL=notification.js.map