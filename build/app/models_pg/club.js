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
import { BaseModel, column, hasMany, belongsTo, manyToMany } from '@adonisjs/lucid/orm';
import User from '#models_pg/user';
import Athlete from '#models_pg/athlete';
import Sport from '#models_pg/sport';
import Season from '#models_pg/season';
import Insight from '#models_pg/insight';
import WorkoutSession from '#models_pg/workout_session';
import ReinforcementExercise from '#models_pg/reinforcement_exercise';
import Activity from '#models_pg/activity';
import EventType from '#models_pg/event_type';
import BiomarkerType from '#models_pg/biomarker_type';
import Prompt from '#models_pg/prompt';
import BasketballGame from '#models_pg/basketball_game';
import SubjectiveFieldConfig from '#models_pg/subjective_field_config';
export default class Club extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], Club.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Club.prototype, "name", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Club.prototype, "sportId", void 0);
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
    __metadata("design:type", String)
], Club.prototype, "language", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], Club.prototype, "createdAt", void 0);
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
    hasMany(() => ReinforcementExercise),
    __metadata("design:type", Object)
], Club.prototype, "exercices", void 0);
__decorate([
    manyToMany(() => Activity, {
        pivotTable: 'blacklist_activities',
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
    manyToMany(() => BiomarkerType, {
        pivotTable: 'biomarker_type_clubs',
    }),
    __metadata("design:type", Object)
], Club.prototype, "biomarkerTypes", void 0);
__decorate([
    hasMany(() => Prompt),
    __metadata("design:type", Object)
], Club.prototype, "prompts", void 0);
__decorate([
    hasMany(() => BasketballGame),
    __metadata("design:type", Object)
], Club.prototype, "basketballGames", void 0);
__decorate([
    hasMany(() => SubjectiveFieldConfig),
    __metadata("design:type", Object)
], Club.prototype, "subjectiveFieldConfigs", void 0);
//# sourceMappingURL=club.js.map