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
import { BaseModel, belongsTo, column, computed } from '@adonisjs/lucid/orm';
import Activity from '#models_pg/activity';
import Athlete from '#models_pg/athlete';
export default class ExerciseLoad extends BaseModel {
    get totalLoadKg() {
        return (this.gearLoadKg ?? 0) + (this.weaponLoadKg ?? 0);
    }
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], ExerciseLoad.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], ExerciseLoad.prototype, "athleteId", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], ExerciseLoad.prototype, "activityId", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ExerciseLoad.prototype, "gearLoadKg", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ExerciseLoad.prototype, "weaponLoadKg", void 0);
__decorate([
    computed(),
    __metadata("design:type", Number),
    __metadata("design:paramtypes", [])
], ExerciseLoad.prototype, "totalLoadKg", null);
__decorate([
    belongsTo(() => Athlete),
    __metadata("design:type", Object)
], ExerciseLoad.prototype, "athlete", void 0);
__decorate([
    belongsTo(() => Activity),
    __metadata("design:type", Object)
], ExerciseLoad.prototype, "activity", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], ExerciseLoad.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], ExerciseLoad.prototype, "updatedAt", void 0);
//# sourceMappingURL=exercise_load.js.map