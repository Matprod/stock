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
import ChatbotDiscussion from '#models/chatbot_discussion';
export default class ChatbotMessage extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], ChatbotMessage.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], ChatbotMessage.prototype, "content", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], ChatbotMessage.prototype, "type", void 0);
__decorate([
    column({
        consume: (v) => (typeof v === 'string' ? JSON.parse(v) : v),
        prepare: (v) => (v ? JSON.stringify(v) : null),
    }),
    __metadata("design:type", Object)
], ChatbotMessage.prototype, "chartData", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], ChatbotMessage.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], ChatbotMessage.prototype, "updatedAt", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], ChatbotMessage.prototype, "chatbotDiscussionId", void 0);
__decorate([
    belongsTo(() => ChatbotDiscussion),
    __metadata("design:type", Object)
], ChatbotMessage.prototype, "chatbotDiscussion", void 0);
//# sourceMappingURL=chatbot_message.js.map