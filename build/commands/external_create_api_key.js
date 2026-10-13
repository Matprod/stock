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
export default class ExternalCreateApiKey extends BaseCommand {
    static commandName = 'external:create-api-key';
    static description = 'Create a club API key for the external Mauna API';
    static options = {
        startApp: true,
    };
    async run() {
        if (!this.clubId || !this.name) {
            this.logger.error('Missing --clubId and --name');
            this.exitCode = 1;
            return;
        }
        const { apiKey, plaintext } = await new ExternalApiKeyService().create({
            clubId: this.clubId,
            name: this.name,
        });
        this.logger.success(`Created API key ${apiKey.id} (${apiKey.keyPrefix}...)`);
        this.logger.warning('Store this key now. It will not be shown again.');
        this.logger.info(plaintext);
    }
}
__decorate([
    flags.string({ description: 'Club id' }),
    __metadata("design:type", String)
], ExternalCreateApiKey.prototype, "clubId", void 0);
__decorate([
    flags.string({ description: 'Label for this key' }),
    __metadata("design:type", String)
], ExternalCreateApiKey.prototype, "name", void 0);
//# sourceMappingURL=external_create_api_key.js.map