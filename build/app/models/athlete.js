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
import Day from '#models/day';
import Injury from '#models/injury';
import Club from '#models/club';
import Discomfort from '#models/discomfort';
import AthleteSport from '#models/athlete_sport';
import AthleteEvent from '#models/athlete_event';
import PlayerPosition from '#models/player_position';
import Recipe from '#models/recipe';
import Aliment from '#models/aliment';
import PlayerNote from '#models/player_note';
import File from '#models/file';
import ExerciseLoad from '#models/exercise_load';
import AthleteProvider from '#models/athlete_provider';
import AthleteToken from '#models/athlete_token';
import Disease from '#models/disease';
export default class Athlete extends BaseModel {
    static table = 'base_athlete';
    get name() {
        return `${this.firstName} ${this.lastName}`;
    }
    get BMR() {
        if (!this.birthDate || !this.weight || !this.height || !this.gender) {
            return 0;
        }
        const age = this.age;
        const weight = this.weight || 0;
        const height = this.height || 0;
        if (this.gender === 'Male') {
            return 11.9 * weight + 5.9 * height - 8.1 * age + 220;
        }
        else {
            return 11.9 * weight + 5.9 * height - 8.1 * age;
        }
    }
    get age() {
        if (!this.birthDate) {
            return 0;
        }
        return Math.floor(DateTime.now().diff(DateTime.fromJSDate(this.birthDate.toJSDate()), 'years').years);
    }
    get appLanguageOrDefault() {
        return this.appLanguage || 'en';
    }
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], Athlete.prototype, "id", void 0);
__decorate([
    column({ serializeAs: null }),
    __metadata("design:type", String)
], Athlete.prototype, "password", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Athlete.prototype, "lastLogin", void 0);
__decorate([
    column(),
    __metadata("design:type", Boolean)
], Athlete.prototype, "isSuperuser", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Athlete.prototype, "username", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Athlete.prototype, "jerseyNumber", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Athlete.prototype, "firstName", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Athlete.prototype, "lastName", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Athlete.prototype, "email", void 0);
__decorate([
    column(),
    __metadata("design:type", Boolean)
], Athlete.prototype, "isStaff", void 0);
__decorate([
    column(),
    __metadata("design:type", Boolean)
], Athlete.prototype, "isActive", void 0);
__decorate([
    column.dateTime(),
    __metadata("design:type", DateTime)
], Athlete.prototype, "dateJoined", void 0);
__decorate([
    column.date(),
    __metadata("design:type", Object)
], Athlete.prototype, "birthDate", void 0);
__decorate([
    column.date(),
    __metadata("design:type", Object)
], Athlete.prototype, "startDate", void 0);
__decorate([
    column.date(),
    __metadata("design:type", Object)
], Athlete.prototype, "endDate", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Athlete.prototype, "height", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Athlete.prototype, "weight", void 0);
__decorate([
    column({ consume: (value) => (value ? parseFloat(value) : null) }),
    __metadata("design:type", Object)
], Athlete.prototype, "fatPercentage", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Athlete.prototype, "gender", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Athlete.prototype, "regularTrainingStartDate", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Athlete.prototype, "watchType", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Athlete.prototype, "facebookUserId", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Athlete.prototype, "googleUserId", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Athlete.prototype, "appleUserId", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Athlete.prototype, "provider", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Athlete.prototype, "checkpoint", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Athlete.prototype, "accountDeleted", void 0);
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
], Athlete.prototype, "dataSource", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Athlete.prototype, "timezoneName", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Athlete.prototype, "timezoneOffset", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Athlete.prototype, "firebaseId", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Athlete.prototype, "fcmDeviceToken", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Athlete.prototype, "appLanguage", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Athlete.prototype, "fcmDeviceId", void 0);
__decorate([
    column({
        serialize: (value) => (value ? `https://mauna-files.s3.amazonaws.com/${value}` : null),
    }),
    __metadata("design:type", Object)
], Athlete.prototype, "profileImage", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Athlete.prototype, "scoreTime", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Athlete.prototype, "hasChanged", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Athlete.prototype, "appleAccessToken", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Athlete.prototype, "dataSources", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], Athlete.prototype, "watchTypes", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], Athlete.prototype, "clubId", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Athlete.prototype, "myCoachPlayerId", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Athlete.prototype, "playerPositionId", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Athlete.prototype, "valdProfileId", void 0);
__decorate([
    column.dateTime(),
    __metadata("design:type", Object)
], Athlete.prototype, "valdLastSyncedAt", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Athlete.prototype, "firstbeatId", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], Athlete.prototype, "catapultId", void 0);
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
    hasMany(() => AthleteSport),
    __metadata("design:type", Object)
], Athlete.prototype, "athleteSports", void 0);
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
    hasMany(() => PlayerNote, { foreignKey: 'athleteId' }),
    __metadata("design:type", Object)
], Athlete.prototype, "notes", void 0);
__decorate([
    hasOne(() => File, { foreignKey: 'athleteId' }),
    __metadata("design:type", Object)
], Athlete.prototype, "profilePicture", void 0);
__decorate([
    hasMany(() => AthleteProvider),
    __metadata("design:type", Object)
], Athlete.prototype, "athleteProviders", void 0);
__decorate([
    hasMany(() => AthleteToken, { foreignKey: 'athleteId' }),
    __metadata("design:type", Object)
], Athlete.prototype, "athleteTokens", void 0);
__decorate([
    hasMany(() => AthleteEvent, {
        foreignKey: 'athleteId',
    }),
    __metadata("design:type", Object)
], Athlete.prototype, "athleteEvents", void 0);
__decorate([
    hasMany(() => Disease),
    __metadata("design:type", Object)
], Athlete.prototype, "diseases", void 0);
//# sourceMappingURL=athlete.js.map