import { ATHLETE_PROVIDER_SOURCE } from '#constants/athlete_provider.constants';
import Disease from '#models/disease';
import Injury from '#models/injury';
import { BaseCommand } from '@adonisjs/core/ace';
export default class UpdateSources extends BaseCommand {
    static commandName = 'db:update_sources';
    static description = 'Updates the source column for existing diseases and injuries';
    static options = { startApp: true };
    async run() {
        this.logger.info('Starting update of the "source" column...');
        try {
            this.logger.info('Updating diseases...');
            await Disease.query().update({ source: ATHLETE_PROVIDER_SOURCE.TMA });
            this.logger.success('✅ All diseases have been updated with "TMA".');
            this.logger.info('Updating injuries...');
            const updatedTMA = await Injury.query()
                .where((query) => {
                query
                    .whereNotNull('mechanism')
                    .orWhereNotNull('tissue')
                    .orWhereNotNull('pathology')
                    .orWhereNotNull('angle');
            })
                .update({ source: ATHLETE_PROVIDER_SOURCE.TMA });
            this.logger.success(`✅ ${updatedTMA} injuries defined as "TMA".`);
            const updatedManual = await Injury.query()
                .whereNull('mechanism')
                .andWhereNull('tissue')
                .andWhereNull('pathology')
                .andWhereNull('angle')
                .update({ source: ATHLETE_PROVIDER_SOURCE.MANUAL });
            this.logger.success(`✅ ${updatedManual} injuries defined as "manual".`);
            this.logger.success('✅ All injuries have been updated.');
        }
        catch (error) {
            this.logger.error('❌ An error occurred during the update:');
            this.logger.error(error.message);
            this.exitCode = 1;
        }
        this.logger.info('End of script.');
    }
}
//# sourceMappingURL=update_sources.js.map