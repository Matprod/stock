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
export default class ExternalListApiKeys extends BaseCommand {
    static commandName = 'external:list-api-keys';
    static description = 'List external API keys for a club';
    static options = {
        startApp: true,
    };
    async run() {
        if (!this.clubId) {
            this.logger.error('Missing --clubId');
            this.exitCode = 1;
            return;
        }
        const keys = await new ExternalApiKeyService().listByClub(this.clubId);
        if (keys.length === 0) {
            this.logger.info('No API keys for this club');
            return;
        }
        const table = this.ui.table();
        table.head(['ID', 'Name', 'Prefix', 'Last used', 'Revoked']);
        for (const key of keys) {
            table.row([
                key.id,
                key.name,
                key.keyPrefix,
                key.lastUsedAt?.toISO() ?? '-',
                key.revokedAt?.toISO() ?? '-',
            ]);
        }
        table.render();
    }
}
__decorate([
    flags.string({ description: 'Club id' }),
    __metadata("design:type", String)
], ExternalListApiKeys.prototype, "clubId", void 0);
//# sourceMappingURL=external_list_api_keys.js.map