var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { BaseModel, column, manyToMany, belongsTo, hasMany, computed } from '@adonisjs/lucid/orm';
import WorkoutSession from '#models/workout_session';
import Activity from '#models/activity';
import Club from '#models/club';
import WorkoutExerciseFavorite from '#models/workout_exercise_favorite';
import { compose } from '@adonisjs/core/helpers';
import { SoftDeletes } from 'adonis-lucid-soft-deletes';
export default class Exercice extends compose(BaseModel, SoftDeletes) {
    static table = 'sportactivity_reinforcementexercices';
    get favorite() {
        return Boolean(this.$extras.favorite);
    }
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], Exercice.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Exercice.prototype, "nameFr", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Exercice.prototype, "nameEn", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Exercice.prototype, "videoLink", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Exercice.prototype, "clubId", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Exercice.prototype, "activityId", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Exercice.prototype, "difficulty", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Exercice.prototype, "estimatedReps", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Exercice.prototype, "estimatedDuration", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Exercice.prototype, "bodyweightPercentage", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Exercice.prototype, "type", void 0);
__decorate([
    computed(),
    __metadata("design:type", Boolean),
    __metadata("design:paramtypes", [])
], Exercice.prototype, "favorite", null);
__decorate([
    belongsTo(() => Activity),
    __metadata("design:type", Object)
], Exercice.prototype, "activity", void 0);
__decorate([
    belongsTo(() => Club),
    __metadata("design:type", Object)
], Exercice.prototype, "club", void 0);
__decorate([
    manyToMany(() => WorkoutSession, {
        pivotTable: 'exercice_workout_session',
    }),
    __metadata("design:type", Object)
], Exercice.prototype, "workoutSessions", void 0);
__decorate([
    hasMany(() => WorkoutExerciseFavorite, {
        foreignKey: 'exerciseId',
        serializeAs: null,
    }),
    __metadata("design:type", Object)
], Exercice.prototype, "workoutExerciseFavorites", void 0);
//# sourceMappingURL=exercice.js.map