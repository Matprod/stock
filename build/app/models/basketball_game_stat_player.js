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
export default class BasketballGameStatPlayer extends BaseModel {
    static table = 'basketball_games_stats_players';
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], BasketballGameStatPlayer.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], BasketballGameStatPlayer.prototype, "basketballGameId", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], BasketballGameStatPlayer.prototype, "apiPlayerId", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], BasketballGameStatPlayer.prototype, "apiTeamId", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStatPlayer.prototype, "playerName", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStatPlayer.prototype, "type", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStatPlayer.prototype, "minutes", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStatPlayer.prototype, "fieldGoalsTotal", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStatPlayer.prototype, "fieldGoalsAttempts", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStatPlayer.prototype, "threepointGoalsTotal", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStatPlayer.prototype, "threepointGoalsAttempts", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStatPlayer.prototype, "freethrowsGoalsTotal", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStatPlayer.prototype, "freethrowsGoalsAttempts", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStatPlayer.prototype, "reboundsTotal", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStatPlayer.prototype, "assists", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStatPlayer.prototype, "points", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGameStatPlayer.prototype, "plusMinus", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], BasketballGameStatPlayer.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], BasketballGameStatPlayer.prototype, "updatedAt", void 0);
__decorate([
    belongsTo(() => BasketballGame, {
        foreignKey: 'basketballGameId',
    }),
    __metadata("design:type", Object)
], BasketballGameStatPlayer.prototype, "basketballGame", void 0);
//# sourceMappingURL=basketball_game_stat_player.js.map