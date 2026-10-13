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
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm';
import ChatbotMessage from '#models_pg/chatbot_message';
import User from '#models_pg/user';
import Athlete from '#models_pg/athlete';
export default class ChatbotDiscussion extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], ChatbotDiscussion.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], ChatbotDiscussion.prototype, "title", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ChatbotDiscussion.prototype, "category", void 0);
__decorate([
    column.date(),
    __metadata("design:type", DateTime)
], ChatbotDiscussion.prototype, "discussionDay", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], ChatbotDiscussion.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], ChatbotDiscussion.prototype, "updatedAt", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ChatbotDiscussion.prototype, "athleteId", void 0);
__decorate([
    belongsTo(() => Athlete),
    __metadata("design:type", Object)
], ChatbotDiscussion.prototype, "athlete", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ChatbotDiscussion.prototype, "userId", void 0);
__decorate([
    belongsTo(() => User),
    __metadata("design:type", Object)
], ChatbotDiscussion.prototype, "user", void 0);
__decorate([
    hasMany(() => ChatbotMessage),
    __metadata("design:type", Object)
], ChatbotDiscussion.prototype, "messages", void 0);
//# sourceMappingURL=chatbot_discussion.js.map