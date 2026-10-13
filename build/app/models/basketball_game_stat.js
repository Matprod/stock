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
import BasketballGame from '#models/basketball_game';
export default class BasketballGameStat extends BaseModel {
    static table = 'basketball_games_stats';
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], BasketballGameStat.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], BasketballGameStat.prototype, "basketballGameId", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStat.prototype, "homeFieldGoalsTotal", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStat.prototype, "homeFieldGoalsAttempts", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStat.prototype, "homeThreepointGoalsTotal", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStat.prototype, "homeThreepointGoalsAttempts", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStat.prototype, "homeFreethrowsGoalsTotal", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStat.prototype, "homeFreethrowsGoalsAttempts", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStat.prototype, "homeReboundsTotal", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStat.prototype, "homeReboundsOffence", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStat.prototype, "homeReboundsDefense", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStat.prototype, "homeAssists", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStat.prototype, "homeSteals", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStat.prototype, "homeBlocks", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStat.prototype, "homeTurnovers", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStat.prototype, "homePersonalFouls", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStat.prototype, "awayFieldGoalsTotal", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStat.prototype, "awayFieldGoalsAttempts", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStat.prototype, "awayThreepointGoalsTotal", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStat.prototype, "awayThreepointGoalsAttempts", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStat.prototype, "awayFreethrowsGoalsTotal", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStat.prototype, "awayFreethrowsGoalsAttempts", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStat.prototype, "awayReboundsTotal", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStat.prototype, "awayReboundsOffence", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStat.prototype, "awayReboundsDefense", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStat.prototype, "awayAssists", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStat.prototype, "awaySteals", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStat.prototype, "awayBlocks", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStat.prototype, "awayTurnovers", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStat.prototype, "awayPersonalFouls", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], BasketballGameStat.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], BasketballGameStat.prototype, "updatedAt", void 0);
__decorate([
    belongsTo(() => BasketballGame, {
        foreignKey: 'basketballGameId',
    }),
    __metadata("design:type", Object)
], BasketballGameStat.prototype, "basketballGame", void 0);
//# sourceMappingURL=basketball_game_stat.js.map