var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { BaseModel, belongsTo, column, hasMany, manyToMany } from '@adonisjs/lucid/orm';
import ReinforcementExercise from '#models_pg/reinforcement_exercise';
import { DateTime } from 'luxon';
import Club from '#models_pg/club';
import WorkoutSessionInstance from '#models_pg/workout_session_instance';
export default class WorkoutSession extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], WorkoutSession.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], WorkoutSession.prototype, "name", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], WorkoutSession.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], WorkoutSession.prototype, "updatedAt", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], WorkoutSession.prototype, "clubId", void 0);
__decorate([
    belongsTo(() => Club),
    __metadata("design:type", Object)
], WorkoutSession.prototype, "club", void 0);
__decorate([
    manyToMany(() => ReinforcementExercise, {
        pivotTable: 'workout_session_exercises',
        pivotForeignKey: 'workout_session_id',
        pivotRelatedForeignKey: 'reinforcement_exercise_id',
    }),
    __metadata("design:type", Object)
], WorkoutSession.prototype, "exercises", void 0);
__decorate([
    hasMany(() => WorkoutSessionInstance),
    __metadata("design:type", Object)
], WorkoutSession.prototype, "instances", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], WorkoutSession.prototype, "durationSeconds", void 0);
//# sourceMappingURL=workout_session.js.map