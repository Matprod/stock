var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { HAMBOURG_CLUB_ID } from '#constants/hambourg.constants';
import { BaseCommand, flags } from '@adonisjs/core/ace';
import db from '@adonisjs/lucid/services/db';
export default class HambourgCleanupOrphanActivities extends BaseCommand {
    static commandName = 'hambourg:cleanup-orphan-activities';
    static description = 'Delete statsports activities with null day_id (calendar crash)';
    static options = {
        startApp: true,
    };
    async run() {
        const clubId = this.clubId || HAMBOURG_CLUB_ID;
        const dryRun = !this.apply;
        const { rows } = await db.rawQuery(`
      SELECT sa.id
      FROM sport_activities sa
      LEFT JOIN events e ON e.id = sa.event_id
      WHERE sa.day_id IS NULL
        AND sa.data_source = 'statsports'
        AND (e.club_id = ? OR sa.event_id IS NULL)
      `, [clubId]);
        const ids = rows.map((row) => row.id);
        this.logger.info(`orphan statsports activities club=${clubId} count=${ids.length} mode=${dryRun ? 'dry-run' : 'APPLY'}`);
        if (dryRun || ids.length === 0)
            return;
        await db.from('sport_activities').whereIn('id', ids).delete();
        this.logger.info(`deleted ${ids.length} orphan activities`);
    }
}
__decorate([
    flags.string({
        description: 'Club id',
        default: HAMBOURG_CLUB_ID,
    }),
    __metadata("design:type", String)
], HambourgCleanupOrphanActivities.prototype, "clubId", void 0);
__decorate([
    flags.boolean({
        description: 'Actually delete the orphan activities',
        default: false,
    }),
    __metadata("design:type", Boolean)
], HambourgCleanupOrphanActivities.prototype, "apply", void 0);
//# sourceMappingURL=hambourg_cleanup_orphan_activities.js.map