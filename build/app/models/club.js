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
import { BaseModel, column, computed, hasMany, belongsTo, manyToMany } from '@adonisjs/lucid/orm';
import User from '#models/user';
import Athlete from '#models/athlete';
import Sport from '#models/sport';
import Season from '#models/season';
import Insight from '#models/insight';
import WorkoutSession from '#models/workout_session';
import Exercice from '#models/exercice';
import Activity from '#models/activity';
import EventType from '#models/event_type';
import Prompt from './prompt.js';
import ClubProvider from '#models/club_provider';
export default class Club extends BaseModel {
    get clubLanguageOrDefault() {
        return this.clubLanguage || 'en';
    }
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], Club.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Club.prototype, "name", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], Club.prototype, "sportId", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Club.prototype, "myCoachClubId", void 0);
__decorate([
    column.date(),
    __metadata("design:type", Object)
], Club.prototype, "startDate", void 0);
__decorate([
    column.date(),
    __metadata("design:type", Object)
], Club.prototype, "endDate", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Club.prototype, "clubLanguage", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], Club.prototype, "createdAt", void 0);
__decorate([
    computed(),
    __metadata("design:type", String),
    __metadata("design:paramtypes", [])
], Club.prototype, "clubLanguageOrDefault", null);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], Club.prototype, "updatedAt", void 0);
__decorate([
    hasMany(() => User),
    __metadata("design:type", Object)
], Club.prototype, "users", void 0);
__decorate([
    hasMany(() => Athlete),
    __metadata("design:type", Object)
], Club.prototype, "athletes", void 0);
__decorate([
    hasMany(() => Season),
    __metadata("design:type", Object)
], Club.prototype, "seasons", void 0);
__decorate([
    belongsTo(() => Sport),
    __metadata("design:type", Object)
], Club.prototype, "sport", void 0);
__decorate([
    manyToMany(() => Insight, {
        pivotTable: 'club_insights',
    }),
    __metadata("design:type", Object)
], Club.prototype, "insights", void 0);
__decorate([
    hasMany(() => WorkoutSession),
    __metadata("design:type", Object)
], Club.prototype, "workoutSessions", void 0);
__decorate([
    hasMany(() => Exercice),
    __metadata("design:type", Object)
], Club.prototype, "exercices", void 0);
__decorate([
    manyToMany(() => Activity, {
        pivotTable: 'black_list_activities',
    }),
    __metadata("design:type", Object)
], Club.prototype, "blackListActivities", void 0);
__decorate([
    manyToMany(() => EventType, {
        pivotTable: 'event_type_clubs',
    }),
    __metadata("design:type", Object)
], Club.prototype, "eventTypes", void 0);
__decorate([
    hasMany(() => Prompt),
    __metadata("design:type", Object)
], Club.prototype, "prompts", void 0);
__decorate([
    hasMany(() => ClubProvider),
    __metadata("design:type", Object)
], Club.prototype, "clubProviders", void 0);
//# sourceMappingURL=club.js.map