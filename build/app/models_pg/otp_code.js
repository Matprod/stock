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
import { BaseModel, column } from '@adonisjs/lucid/orm';
import { normalizeEmail } from '#utils/email';
export default class OtpCode extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", String)
], OtpCode.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], OtpCode.prototype, "code", void 0);
__decorate([
    column.dateTime(),
    __metadata("design:type", DateTime)
], OtpCode.prototype, "expiresAt", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], OtpCode.prototype, "index", void 0);
__decorate([
    column({
        prepare: (value) => (value ? normalizeEmail(value) : value),
        consume: (value) => (value ? normalizeEmail(value) : value),
    }),
    __metadata("design:type", Object)
], OtpCode.prototype, "email", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], OtpCode.prototype, "purpose", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], OtpCode.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], OtpCode.prototype, "updatedAt", void 0);
//# sourceMappingURL=otp_code.js.map