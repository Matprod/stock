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
import WorkoutSession from '#models/workout_session';
import SportActivityExerciseSet from '#models/sport_activity_exercise_set';
import SportActivity from '#models/sport_activity';
export default class WorkoutSessionInstance extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], WorkoutSessionInstance.prototype, "id", void 0);
__decorate([
    column.dateTime(),
    __metadata("design:type", DateTime)
], WorkoutSessionInstance.prototype, "startTime", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], WorkoutSessionInstance.prototype, "duration", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], WorkoutSessionInstance.prototype, "title", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], WorkoutSessionInstance.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], WorkoutSessionInstance.prototype, "updatedAt", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], WorkoutSessionInstance.prototype, "workoutSessionId", void 0);
__decorate([
    belongsTo(() => WorkoutSession),
    __metadata("design:type", Object)
], WorkoutSessionInstance.prototype, "workoutSession", void 0);
__decorate([
    hasMany(() => SportActivityExerciseSet),
    __metadata("design:type", Object)
], WorkoutSessionInstance.prototype, "exercises", void 0);
__decorate([
    hasMany(() => SportActivity),
    __metadata("design:type", Object)
], WorkoutSessionInstance.prototype, "sportActivities", void 0);
//# sourceMappingURL=workout_session_instance.js.map