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
import ReinforcementExercise from '#models_pg/reinforcement_exercise';
import SportActivity from '#models_pg/sport_activity';
import WorkoutSessionInstance from './workout_session_instance.js';
export default class ExerciseSet extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], ExerciseSet.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ExerciseSet.prototype, "reps", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ExerciseSet.prototype, "weight", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ExerciseSet.prototype, "durationSeconds", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ExerciseSet.prototype, "order", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ExerciseSet.prototype, "setOrder", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], ExerciseSet.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], ExerciseSet.prototype, "updatedAt", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], ExerciseSet.prototype, "exerciseId", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ExerciseSet.prototype, "sportActivityId", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ExerciseSet.prototype, "workoutSessionInstanceId", void 0);
__decorate([
    belongsTo(() => ReinforcementExercise, {
        foreignKey: 'exerciseId',
    }),
    __metadata("design:type", Object)
], ExerciseSet.prototype, "exercise", void 0);
__decorate([
    belongsTo(() => SportActivity),
    __metadata("design:type", Object)
], ExerciseSet.prototype, "sportActivity", void 0);
__decorate([
    belongsTo(() => WorkoutSessionInstance),
    __metadata("design:type", Object)
], ExerciseSet.prototype, "workoutSessionInstance", void 0);
//# sourceMappingURL=exercise_set.js.map