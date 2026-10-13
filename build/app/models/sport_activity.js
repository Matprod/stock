var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { BaseModel, belongsTo, column, computed, hasMany } from '@adonisjs/lucid/orm';
import Day from '#models/day';
import Activity from '#models/activity';
import SportActivityPain from '#models/sport_activity_pain';
import FoodIntake from '#models/food_intake';
import SportActivityExerciseSet from '#models/sport_activity_exercise_set';
import WorkoutSessionInstance from '#models/workout_session_instance';
import Period from '#models/period';
import Event from '#models/event';
export default class SportActivity extends BaseModel {
    static table = 'sportactivity_sportactivity';
    get durationInMinutes() {
        return this.duration ? this.duration / 60000000 : null;
    }
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], SportActivity.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "activityName", void 0);
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
], SportActivity.prototype, "duration", void 0);
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
    column.dateTime(),
    __metadata("design:type", Object)
], SportActivity.prototype, "dateAdded", void 0);
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
], SportActivity.prototype, "deviceName", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "cadence", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "elevationDescent", void 0);
__decorate([
    column.dateTime(),
    __metadata("design:type", Object)
], SportActivity.prototype, "dateUpdated", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "hasChanged", void 0);
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
], SportActivity.prototype, "strain", void 0);
__decorate([
    column({
        columnName: 'distance_0_7_kmh',
        consume: (value) => (value ? parseFloat(value) : null),
    }),
    __metadata("design:type", Object)
], SportActivity.prototype, "distance0To7Kmh", void 0);
__decorate([
    column({
        columnName: 'distance_7_14_kmh',
        consume: (value) => (value ? parseFloat(value) : null),
    }),
    __metadata("design:type", Object)
], SportActivity.prototype, "distance7To14Kmh", void 0);
__decorate([
    column({
        columnName: 'distance_14_19_kmh',
        consume: (value) => (value ? parseFloat(value) : null),
    }),
    __metadata("design:type", Object)
], SportActivity.prototype, "distance14To19Kmh", void 0);
__decorate([
    column({
        columnName: 'distance_19_25_kmh',
        consume: (value) => (value ? parseFloat(value) : null),
    }),
    __metadata("design:type", Object)
], SportActivity.prototype, "distance19To25Kmh", void 0);
__decorate([
    column({
        columnName: 'distance_25_plus_kmh',
        consume: (value) => (value ? parseFloat(value) : null),
    }),
    __metadata("design:type", Object)
], SportActivity.prototype, "distance25PlusKmh", void 0);
__decorate([
    column({ columnName: 'nb_efforts_above_19_8_kmh' }),
    __metadata("design:type", Object)
], SportActivity.prototype, "nbEffortsAbove19_8Kmh", void 0);
__decorate([
    column({ columnName: 'nb_efforts_above_25_kmh' }),
    __metadata("design:type", Object)
], SportActivity.prototype, "nbEffortsAbove25Kmh", void 0);
__decorate([
    column({ columnName: 'top_speed', consume: (value) => (value ? parseFloat(value) : null) }),
    __metadata("design:type", Object)
], SportActivity.prototype, "topSpeed", void 0);
__decorate([
    column({ columnName: 'event_type' }),
    __metadata("design:type", Object)
], SportActivity.prototype, "eventType", void 0);
__decorate([
    column({
        columnName: 'vmax_acceleration',
        consume: (value) => (value ? parseFloat(value) : null),
    }),
    __metadata("design:type", Object)
], SportActivity.prototype, "vmaxAcceleration", void 0);
__decorate([
    column({
        columnName: 'vmax_deceleration',
        consume: (value) => (value ? parseFloat(value) : null),
    }),
    __metadata("design:type", Object)
], SportActivity.prototype, "vmaxDeceleration", void 0);
__decorate([
    column({ columnName: 'nb_decelerations_above_3ms2' }),
    __metadata("design:type", Object)
], SportActivity.prototype, "nbDecelerationsAbove3ms2", void 0);
__decorate([
    column({ columnName: 'nb_accelerations_above_3ms2' }),
    __metadata("design:type", Object)
], SportActivity.prototype, "nbAccelerationsAbove3ms2", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "energyConsumptionCarbs", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "energyConsumptionFats", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "epocFinal", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "epocPeak", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "hfAverage", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "lfAverage", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "lfHfRatio", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "rmssd", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "trimp", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "movementLoad", void 0);
__decorate([
    column({ columnName: 'zone1_time' }),
    __metadata("design:type", Object)
], SportActivity.prototype, "zone1Time", void 0);
__decorate([
    column({ columnName: 'zone2_time' }),
    __metadata("design:type", Object)
], SportActivity.prototype, "zone2Time", void 0);
__decorate([
    column({ columnName: 'zone3_time' }),
    __metadata("design:type", Object)
], SportActivity.prototype, "zone3Time", void 0);
__decorate([
    column({ columnName: 'zone4_time' }),
    __metadata("design:type", Object)
], SportActivity.prototype, "zone4Time", void 0);
__decorate([
    column({ columnName: 'zone5_time' }),
    __metadata("design:type", Object)
], SportActivity.prototype, "zone5Time", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "fcMax", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "carriedWeight", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "weaponWeight", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "burstCount", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "heartExertion", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "groundImpact", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "descentDuration", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "averageDescentSpeed", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "freefallDuration", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "maxFreefallSpeed", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], SportActivity.prototype, "canopyDuration", void 0);
__decorate([
    computed(),
    __metadata("design:type", Object),
    __metadata("design:paramtypes", [])
], SportActivity.prototype, "durationInMinutes", null);
__decorate([
    column(),
    __metadata("design:type", Number)
], SportActivity.prototype, "athleteDayId", void 0);
__decorate([
    belongsTo(() => Day, {
        foreignKey: 'athleteDayId',
    }),
    __metadata("design:type", Object)
], SportActivity.prototype, "athleteDay", void 0);
__decorate([
    column({ columnName: 'activity_type_id' }),
    __metadata("design:type", Object)
], SportActivity.prototype, "activity_type_id", void 0);
__decorate([
    belongsTo(() => Activity, {
        foreignKey: 'activity_type_id',
    }),
    __metadata("design:type", Object)
], SportActivity.prototype, "sport", void 0);
__decorate([
    hasMany(() => SportActivityPain),
    __metadata("design:type", Object)
], SportActivity.prototype, "sportActivityPains", void 0);
__decorate([
    hasMany(() => FoodIntake),
    __metadata("design:type", Object)
], SportActivity.prototype, "foodIntakes", void 0);
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
    belongsTo(() => Event, {
        foreignKey: 'eventId',
    }),
    __metadata("design:type", Object)
], SportActivity.prototype, "event", void 0);
//# sourceMappingURL=sport_activity.js.map