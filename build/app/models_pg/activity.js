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
import ReinforcementExercise from '#models_pg/reinforcement_exercise';
import ActivityDisplayVariable from '#models_pg/activity_display_variable';
export default class Activity extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], Activity.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Activity.prototype, "name", void 0);
__decorate([
    hasMany(() => ReinforcementExercise),
    __metadata("design:type", Object)
], Activity.prototype, "exercices", void 0);
__decorate([
    hasMany(() => ActivityDisplayVariable),
    __metadata("design:type", Object)
], Activity.prototype, "activityDisplayVariables", void 0);
//# sourceMappingURL=activity.js.map