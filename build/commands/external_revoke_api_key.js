var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { BaseCommand, flags } from '@adonisjs/core/ace';
import ExternalApiKeyService from '#services/external_api_key_service';
export default class ExternalRevokeApiKey extends BaseCommand {
    static commandName = 'external:revoke-api-key';
    static description = 'Revoke an external API key';
    static options = {
        startApp: true,
    };
    async run() {
        if (!this.id) {
            this.logger.error('Missing --id');
            this.exitCode = 1;
            return;
        }
        const apiKey = await new ExternalApiKeyService().revoke(this.id);
        this.logger.success(`Revoked API key ${apiKey.id} (${apiKey.keyPrefix}...)`);
    }
}
__decorate([
    flags.string({ description: 'API key id' }),
    __metadata("design:type", String)
], ExternalRevokeApiKey.prototype, "id", void 0);
//# sourceMappingURL=external_revoke_api_key.js.map