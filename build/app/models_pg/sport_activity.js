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
import { BaseModel, belongsTo, column, computed, hasMany } from '@adonisjs/lucid/orm';
import Day from '#models_pg/day';
import Activity from '#models_pg/activity';
import SportActivityPain from '#models_pg/sport_activity_pain';
import ActivityFoodIntake from '#models_pg/activity_food_intake';
import SportActivityExerciseSet from '#models_pg/exercise_set';
import WorkoutSessionInstance from '#models_pg/workout_session_instance';
import Period from '#models_pg/period';
import Event from '#models_pg/event';
import SportActivityMetricValue from '#models_pg/sport_activity_metric_value';
export default class SportActivity extends BaseModel {
    get durationInMinutes() {
        return this.durationSeconds !== null && this.durationSeconds !== undefined
            ? Math.round(this.durationSeconds / 60)
            : null;
    }
    get durationMinutes() {
        return this.durationInMinutes ?? 0;
    }
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], SportActivity.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], SportActivity.prototype, "dataSource", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "distance", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "speed", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "durationSeconds", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "elevation", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "power", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "averagedBpm", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "rpe", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "fitnessLevel", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "cardioRespiratory", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "muscularDifficulty", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "timeOfActivity", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "fatigueLevel", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "pleasureLevel", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "activeCalories", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "cadence", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "elevationDescent", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "trainingLoad", void 0);
__decorate([
    column({
        consume: (value) => (value === null || value === undefined ? null : Boolean(value)),
        prepare: (value) => value === null || value === undefined ? null : value ? 1 : 0,
    }),
    __metadata("design:type", Object)
], SportActivity.prototype, "gameActivity", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "fcMax", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "activityName", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "sessionComment", void 0);
__decorate([
    column(),
    __metadata("design:type", Boolean)
], SportActivity.prototype, "needsReview", void 0);
__decorate([
    computed(),
    __metadata("design:type", Object),
    __metadata("design:paramtypes", [])
], SportActivity.prototype, "durationInMinutes", null);
__decorate([
    computed(),
    __metadata("design:type", Number),
    __metadata("design:paramtypes", [])
], SportActivity.prototype, "durationMinutes", null);
__decorate([
    column(),
    __metadata("design:type", String)
], SportActivity.prototype, "dayId", void 0);
__decorate([
    belongsTo(() => Day),
    __metadata("design:type", Object)
], SportActivity.prototype, "day", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "activityTypeId", void 0);
__decorate([
    belongsTo(() => Activity, {
        foreignKey: 'activityTypeId',
    }),
    __metadata("design:type", Object)
], SportActivity.prototype, "sport", void 0);
__decorate([
    hasMany(() => SportActivityPain),
    __metadata("design:type", Object)
], SportActivity.prototype, "sportActivityPains", void 0);
__decorate([
    hasMany(() => ActivityFoodIntake),
    __metadata("design:type", Object)
], SportActivity.prototype, "activityFoodIntakes", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "workoutSessionInstanceId", void 0);
__decorate([
    belongsTo(() => WorkoutSessionInstance),
    __metadata("design:type", Object)
], SportActivity.prototype, "workoutSessionInstance", void 0);
__decorate([
    hasMany(() => Period),
    __metadata("design:type", Object)
], SportActivity.prototype, "periods", void 0);
__decorate([
    hasMany(() => SportActivityMetricValue),
    __metadata("design:type", Object)
], SportActivity.prototype, "metricValues", void 0);
__decorate([
    hasMany(() => SportActivityExerciseSet, {
        foreignKey: 'sportActivityId',
    }),
    __metadata("design:type", Object)
], SportActivity.prototype, "exerciseSets", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "eventId", void 0);
__decorate([
    belongsTo(() => Event),
    __metadata("design:type", Object)
], SportActivity.prototype, "event", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], SportActivity.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], SportActivity.prototype, "updatedAt", void 0);
//# sourceMappingURL=sport_activity.js.map