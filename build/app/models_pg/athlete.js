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
import { BaseModel, column, computed, hasMany, belongsTo, hasOne } from '@adonisjs/lucid/orm';
import Day from '#models_pg/day';
import Injury from '#models_pg/injury';
import Club from '#models_pg/club';
import Discomfort from '#models_pg/pain_discomfort_location';
import AthleteEvent from '#models_pg/athlete_event';
import PlayerPosition from '#models_pg/player_position';
import Recipe from '#models_pg/recipe';
import Aliment from '#models_pg/aliment';
import PlayerNote from '#models_pg/player_note';
import File from '#models_pg/file';
import ExerciseLoad from '#models_pg/exercise_load';
import AthleteProvider from '#models_pg/athlete_provider';
import Disease from '#models_pg/disease';
import Token from '#models_pg/token';
import { GENDER } from '#constants/athlete.constants';
import { normalizeEmail } from '#utils/email';
export default class Athlete extends BaseModel {
    get name() {
        return `${this.firstName} ${this.lastName}`;
    }
    get BMR() {
        if (!this.birthDate || !this.weightKg || !this.heightCm || !this.gender) {
            return 0;
        }
        const age = this.age;
        const weight = this.weightKg || 0;
        const height = this.heightCm || 0;
        const sexFactor = this.gender === GENDER.MALE ? 1 : -1;
        return 11.936 * weight + 5.877 * height - 8.129 * age + 191.027 + 29.279 * sexFactor;
    }
    get age() {
        if (!this.birthDate) {
            return 0;
        }
        return Math.floor(DateTime.now().diff(this.birthDate, 'years').years);
    }
    get effectiveFcMax() {
        if (this.fcMax && this.fcMax !== 0) {
            return this.fcMax;
        }
        return this.age > 0 ? 220 - this.age : 200;
    }
    get appLanguageOrDefault() {
        return this.appLanguage;
    }
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], Athlete.prototype, "id", void 0);
__decorate([
    column({ serializeAs: null }),
    __metadata("design:type", String)
], Athlete.prototype, "password", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Athlete.prototype, "firstName", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Athlete.prototype, "lastName", void 0);
__decorate([
    column({
        prepare: (value) => normalizeEmail(value),
        consume: (value) => normalizeEmail(value),
    }),
    __metadata("design:type", String)
], Athlete.prototype, "email", void 0);
__decorate([
    column.date(),
    __metadata("design:type", DateTime)
], Athlete.prototype, "birthDate", void 0);
__decorate([
    column.date(),
    __metadata("design:type", DateTime)
], Athlete.prototype, "startDate", void 0);
__decorate([
    column.date(),
    __metadata("design:type", Object)
], Athlete.prototype, "endDate", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Athlete.prototype, "jerseyNumber", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Athlete.prototype, "heightCm", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Athlete.prototype, "weightKg", void 0);
__decorate([
    column({ consume: (value) => (value ? parseFloat(value) : null) }),
    __metadata("design:type", Object)
], Athlete.prototype, "fatPercentage", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Athlete.prototype, "gender", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Athlete.prototype, "fcMax", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Athlete.prototype, "fcMin", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Athlete.prototype, "fcmDeviceToken", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Athlete.prototype, "appLanguage", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Athlete.prototype, "clubId", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Athlete.prototype, "playerPositionId", void 0);
__decorate([
    belongsTo(() => PlayerPosition),
    __metadata("design:type", Object)
], Athlete.prototype, "playerPosition", void 0);
__decorate([
    computed(),
    __metadata("design:type", String),
    __metadata("design:paramtypes", [])
], Athlete.prototype, "name", null);
__decorate([
    computed(),
    __metadata("design:type", Number),
    __metadata("design:paramtypes", [])
], Athlete.prototype, "BMR", null);
__decorate([
    computed(),
    __metadata("design:type", Number),
    __metadata("design:paramtypes", [])
], Athlete.prototype, "age", null);
__decorate([
    computed(),
    __metadata("design:type", Number),
    __metadata("design:paramtypes", [])
], Athlete.prototype, "effectiveFcMax", null);
__decorate([
    computed(),
    __metadata("design:type", String),
    __metadata("design:paramtypes", [])
], Athlete.prototype, "appLanguageOrDefault", null);
__decorate([
    hasMany(() => Day),
    __metadata("design:type", Object)
], Athlete.prototype, "days", void 0);
__decorate([
    hasMany(() => Injury),
    __metadata("design:type", Object)
], Athlete.prototype, "injuries", void 0);
__decorate([
    hasMany(() => Discomfort),
    __metadata("design:type", Object)
], Athlete.prototype, "discomforts", void 0);
__decorate([
    hasMany(() => ExerciseLoad),
    __metadata("design:type", Object)
], Athlete.prototype, "exerciseLoads", void 0);
__decorate([
    belongsTo(() => Club),
    __metadata("design:type", Object)
], Athlete.prototype, "club", void 0);
__decorate([
    hasMany(() => Recipe),
    __metadata("design:type", Object)
], Athlete.prototype, "recipes", void 0);
__decorate([
    hasMany(() => Aliment),
    __metadata("design:type", Object)
], Athlete.prototype, "aliments", void 0);
__decorate([
    hasMany(() => PlayerNote),
    __metadata("design:type", Object)
], Athlete.prototype, "notes", void 0);
__decorate([
    hasOne(() => File),
    __metadata("design:type", Object)
], Athlete.prototype, "profilePicture", void 0);
__decorate([
    hasMany(() => AthleteProvider),
    __metadata("design:type", Object)
], Athlete.prototype, "athleteProviders", void 0);
__decorate([
    hasMany(() => Token),
    __metadata("design:type", Object)
], Athlete.prototype, "athleteTokens", void 0);
__decorate([
    hasMany(() => AthleteEvent),
    __metadata("design:type", Object)
], Athlete.prototype, "athleteEvents", void 0);
__decorate([
    hasMany(() => Disease),
    __metadata("design:type", Object)
], Athlete.prototype, "diseases", void 0);
//# sourceMappingURL=athlete.js.map