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
import { BaseModel, belongsTo, column, hasMany, manyToMany } from '@adonisjs/lucid/orm';
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens';
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid';
import hash from '@adonisjs/core/services/hash';
import { compose } from '@adonisjs/core/helpers';
import Club from '#models_pg/club';
import Permission from '#models_pg/permission';
import WorkoutExerciseFavorite from '#models_pg/workout_exercise_favorite';
import { normalizeEmail } from '#utils/email';
const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
    uids: ['email'],
    passwordColumnName: 'password',
});
export default class User extends compose(BaseModel, AuthFinder) {
    static accessTokens = DbAccessTokensProvider.forModel(User);
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], User.prototype, "id", void 0);
__decorate([
    column({
        prepare: (value) => normalizeEmail(value),
        consume: (value) => normalizeEmail(value),
    }),
    __metadata("design:type", String)
], User.prototype, "email", void 0);
__decorate([
    column({ serializeAs: null }),
    __metadata("design:type", String)
], User.prototype, "password", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], User.prototype, "defaultPage", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], User.prototype, "role", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], User.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], User.prototype, "updatedAt", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], User.prototype, "clubId", void 0);
__decorate([
    belongsTo(() => Club),
    __metadata("design:type", Object)
], User.prototype, "club", void 0);
__decorate([
    manyToMany(() => Permission, {
        pivotTable: 'user_permissions',
    }),
    __metadata("design:type", Object)
], User.prototype, "permissions", void 0);
__decorate([
    hasMany(() => WorkoutExerciseFavorite),
    __metadata("design:type", Object)
], User.prototype, "workoutExerciseFavorites", void 0);
//# sourceMappingURL=user.js.map