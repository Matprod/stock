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
import Exercice from '#models/exercice';
import SportActivity from '#models/sport_activity';
import WorkoutSessionInstance from './workout_session_instance.js';
export default class SportActivityExerciseSet extends BaseModel {
    static table = 'sportactivity_exerciseset';
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], SportActivityExerciseSet.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivityExerciseSet.prototype, "reps", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivityExerciseSet.prototype, "weight", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivityExerciseSet.prototype, "time", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivityExerciseSet.prototype, "order", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivityExerciseSet.prototype, "setOrder", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", Object)
], SportActivityExerciseSet.prototype, "dateAdded", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], SportActivityExerciseSet.prototype, "dateUpdated", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], SportActivityExerciseSet.prototype, "exerciseId", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivityExerciseSet.prototype, "sportActivityId", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivityExerciseSet.prototype, "workoutSessionInstanceId", void 0);
__decorate([
    belongsTo(() => Exercice, {
        foreignKey: 'exerciseId',
    }),
    __metadata("design:type", Object)
], SportActivityExerciseSet.prototype, "exercise", void 0);
__decorate([
    belongsTo(() => SportActivity, {
        foreignKey: 'sportActivityId',
    }),
    __metadata("design:type", Object)
], SportActivityExerciseSet.prototype, "sportActivity", void 0);
__decorate([
    belongsTo(() => WorkoutSessionInstance),
    __metadata("design:type", Object)
], SportActivityExerciseSet.prototype, "workoutSessionInstance", void 0);
//# sourceMappingURL=sport_activity_exercise_set.js.map