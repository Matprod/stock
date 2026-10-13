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
import Athlete from '#models_pg/athlete';
import Aliment from '#models_pg/aliment';
import LlmAliment from '#models_pg/llm_aliment';
export default class FavoriteAliment extends BaseModel {
    get source() {
        if (this.alimentId) {
            return 'aliment';
        }
        return 'llm_aliment';
    }
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], FavoriteAliment.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], FavoriteAliment.prototype, "athleteId", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], FavoriteAliment.prototype, "alimentId", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], FavoriteAliment.prototype, "llmAlimentId", void 0);
__decorate([
    column(),
    __metadata("design:type", Array)
], FavoriteAliment.prototype, "mealTypes", void 0);
__decorate([
    computed(),
    __metadata("design:type", String),
    __metadata("design:paramtypes", [])
], FavoriteAliment.prototype, "source", null);
__decorate([
    belongsTo(() => Athlete),
    __metadata("design:type", Object)
], FavoriteAliment.prototype, "athlete", void 0);
__decorate([
    belongsTo(() => Aliment),
    __metadata("design:type", Object)
], FavoriteAliment.prototype, "aliment", void 0);
__decorate([
    belongsTo(() => LlmAliment),
    __metadata("design:type", Object)
], FavoriteAliment.prototype, "llmAliment", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], FavoriteAliment.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], FavoriteAliment.prototype, "updatedAt", void 0);
//# sourceMappingURL=favorite_aliments.js.map