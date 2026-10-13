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
import { BaseModel, column, manyToMany } from '@adonisjs/lucid/orm';
import Notification from '#models/notification';
export default class NotificationMessage extends BaseModel {
    static table = 'notifications_messages';
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], NotificationMessage.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], NotificationMessage.prototype, "title", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], NotificationMessage.prototype, "content", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], NotificationMessage.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], NotificationMessage.prototype, "updatedAt", void 0);
__decorate([
    manyToMany(() => Notification, {
        pivotTable: 'notification_message_links',
    }),
    __metadata("design:type", Object)
], NotificationMessage.prototype, "notifications", void 0);
//# sourceMappingURL=notification_message.js.map