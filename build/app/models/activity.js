var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm';
import Exercice from '#models/exercice';
import ActivityDisplayVariable from '#models/activity_display_variable';
export default class Activity extends BaseModel {
    static table = 'base_activity';
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], Activity.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Activity.prototype, "nameFr", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Activity.prototype, "nameEn", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Activity.prototype, "distance", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Activity.prototype, "distanceUnit", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Activity.prototype, "speed", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Activity.prototype, "speedUnit", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Activity.prototype, "duration", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Activity.prototype, "elevation", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Activity.prototype, "elevationUnit", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Activity.prototype, "gpsData", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Activity.prototype, "power", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Activity.prototype, "powerUnit", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Activity.prototype, "averagedBpm", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Activity.prototype, "rpe", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Activity.prototype, "trainingLoad", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Activity.prototype, "fitnessLevel", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Activity.prototype, "fatigueLevel", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Activity.prototype, "pleasureLevel", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Activity.prototype, "cardioRespiratory", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Activity.prototype, "muscularDifficulty", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Activity.prototype, "allExerciseTypes", void 0);
__decorate([
    hasMany(() => Exercice),
    __metadata("design:type", Object)
], Activity.prototype, "exercices", void 0);
__decorate([
    hasMany(() => ActivityDisplayVariable),
    __metadata("design:type", Object)
], Activity.prototype, "activityDisplayVariables", void 0);
//# sourceMappingURL=activity.js.map