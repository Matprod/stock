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
import Club from '#models_pg/club';
import WorkoutExerciseFavorite from '#models_pg/workout_exercise_favorite';
import Activity from '#models_pg/activity';
export default class ReinforcementExercise extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], ReinforcementExercise.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], ReinforcementExercise.prototype, "name", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], ReinforcementExercise.prototype, "type", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], ReinforcementExercise.prototype, "difficulty", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ReinforcementExercise.prototype, "videoLink", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ReinforcementExercise.prototype, "estimatedReps", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ReinforcementExercise.prototype, "estimatedDuration", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ReinforcementExercise.prototype, "bodyweightPercentage", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ReinforcementExercise.prototype, "clubId", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], ReinforcementExercise.prototype, "activityId", void 0);
__decorate([
    belongsTo(() => Activity),
    __metadata("design:type", Object)
], ReinforcementExercise.prototype, "activity", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], ReinforcementExercise.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], ReinforcementExercise.prototype, "updatedAt", void 0);
__decorate([
    belongsTo(() => Club),
    __metadata("design:type", Object)
], ReinforcementExercise.prototype, "club", void 0);
__decorate([
    hasMany(() => WorkoutExerciseFavorite, { foreignKey: 'exerciseId' }),
    __metadata("design:type", Object)
], ReinforcementExercise.prototype, "workoutExerciseFavorites", void 0);
//# sourceMappingURL=reinforcement_exercise.js.map