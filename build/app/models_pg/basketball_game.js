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
import { BaseModel, column, belongsTo, hasOne, hasMany, computed } from '@adonisjs/lucid/orm';
import Club from '#models_pg/club';
import Event from '#models_pg/event';
import BasketballGameStat from '#models_pg/basketball_game_stat';
import BasketballGameStatPlayer from '#models_pg/basketball_game_player_stat';
export default class BasketballGame extends BaseModel {
    get matchResult() {
        return `${this.homeScoreTotal}-${this.awayScoreTotal}`;
    }
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], BasketballGame.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], BasketballGame.prototype, "clubId", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGame.prototype, "eventId", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], BasketballGame.prototype, "apiGameId", void 0);
__decorate([
    column.dateTime(),
    __metadata("design:type", DateTime)
], BasketballGame.prototype, "startTime", void 0);
__decorate([
    column.dateTime(),
    __metadata("design:type", DateTime)
], BasketballGame.prototype, "endTime", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], BasketballGame.prototype, "timestamp", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], BasketballGame.prototype, "title", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGame.prototype, "location", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGame.prototype, "statusShort", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGame.prototype, "leagueId", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGame.prototype, "leagueName", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGame.prototype, "leagueSeason", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGame.prototype, "leagueLogo", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], BasketballGame.prototype, "homeTeamId", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], BasketballGame.prototype, "homeTeamName", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], BasketballGame.prototype, "awayTeamId", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], BasketballGame.prototype, "awayTeamName", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGame.prototype, "homeScoreQ1", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGame.prototype, "homeScoreQ2", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGame.prototype, "homeScoreQ3", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGame.prototype, "homeScoreQ4", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGame.prototype, "homeScoreOt", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGame.prototype, "homeScoreTotal", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGame.prototype, "awayScoreQ1", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGame.prototype, "awayScoreQ2", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGame.prototype, "awayScoreQ3", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGame.prototype, "awayScoreQ4", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGame.prototype, "awayScoreOt", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], BasketballGame.prototype, "awayScoreTotal", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], BasketballGame.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], BasketballGame.prototype, "updatedAt", void 0);
__decorate([
    computed(),
    __metadata("design:type", Object),
    __metadata("design:paramtypes", [])
], BasketballGame.prototype, "matchResult", null);
__decorate([
    belongsTo(() => Club),
    __metadata("design:type", Object)
], BasketballGame.prototype, "club", void 0);
__decorate([
    belongsTo(() => Event),
    __metadata("design:type", Object)
], BasketballGame.prototype, "event", void 0);
__decorate([
    hasOne(() => BasketballGameStat),
    __metadata("design:type", Object)
], BasketballGame.prototype, "gameStat", void 0);
__decorate([
    hasMany(() => BasketballGameStatPlayer),
    __metadata("design:type", Object)
], BasketballGame.prototype, "playerStats", void 0);
//# sourceMappingURL=basketball_game.js.map