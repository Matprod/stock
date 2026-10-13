var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm';
import Club from './club.js';
export default class ChatbotQuestions extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], ChatbotQuestions.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], ChatbotQuestions.prototype, "question", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ChatbotQuestions.prototype, "category", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], ChatbotQuestions.prototype, "type", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], ChatbotQuestions.prototype, "title", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], ChatbotQuestions.prototype, "order", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], ChatbotQuestions.prototype, "clubId", void 0);
__decorate([
    belongsTo(() => Club),
    __metadata("design:type", Object)
], ChatbotQuestions.prototype, "club", void 0);
//# sourceMappingURL=chatbot_questions.js.map