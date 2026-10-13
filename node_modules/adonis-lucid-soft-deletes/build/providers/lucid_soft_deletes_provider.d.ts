import type { ApplicationService } from '@adonisjs/core/types';
export default class LucidSoftDeletesProvider {
    protected app: ApplicationService;
    constructor(app: ApplicationService);
    boot(): Promise<void>;
}
