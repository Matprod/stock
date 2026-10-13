var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { readFile } from 'node:fs/promises';
import { BaseCommand, flags } from '@adonisjs/core/ace';
import db from '@adonisjs/lucid/services/db';
import Insight from '#models_pg/insight';
import Translation from '#models_pg/translation';
import { INSIGHT_TRESHOLD_TYPE } from '#constants/insight.constants';
import { TRANSLATABLE_TYPES, TRANSLATION_KEYS } from '#constants/translation.constants';
import { APP_LANGUAGES } from '#utils/localize';
const HAMBURG_CLUB_ID = '019fa7cc-684c-783e-9609-c132a26eb4e3';
const CSV_RELATIVE_PATH = 'hambourg/features_hambourg.csv';
export default class HambourgUpdateInsightTexts extends BaseCommand {
    static commandName = 'hambourg:update_insight_texts';
    static description = 'Update Hamburg insight names and descriptions from features_hambourg.csv';
    static options = { startApp: true };
    async run() {
        const rows = await this.parseCsv();
        if (rows.length === 0) {
            this.logger.error('No feature rows found in CSV');
            this.exitCode = 1;
            return;
        }
        const club = await db.connection('pg').from('clubs').where('id', HAMBURG_CLUB_ID).first();
        if (!club) {
            const allClubs = await db.connection('pg').from('clubs').select('id', 'name');
            this.logger.error(`Hamburg club ${HAMBURG_CLUB_ID} not found`);
            this.logger.error(`Clubs=${JSON.stringify(allClubs)}`);
            this.exitCode = 1;
            return;
        }
        const insights = await Insight.query().preload('clubs');
        const byId = new Map(insights.map((insight) => [insight.id, insight]));
        const byVariable = new Map();
        for (const insight of insights) {
            const list = byVariable.get(insight.variableName) ?? [];
            list.push(insight);
            byVariable.set(insight.variableName, list);
        }
        let updated = 0;
        let created = 0;
        let unchanged = 0;
        let linked = 0;
        const persist = async () => {
            for (const row of rows) {
                let insight = this.resolveInsight(row, byId, byVariable);
                if (!insight) {
                    this.logger.info(`${this.dryRun ? '[dry-run] ' : ''}Create ${row.variable}${row.insightId ? ` (${row.insightId})` : ''}`);
                    if (!this.dryRun) {
                        insight = await this.createInsight(row);
                        byId.set(insight.id, insight);
                        const list = byVariable.get(insight.variableName) ?? [];
                        list.push(insight);
                        byVariable.set(insight.variableName, list);
                        await this.upsertInsightTranslations(insight.id, row.name, row.description);
                    }
                    created += 1;
                    if (this.dryRun)
                        continue;
                }
                else {
                    const nameChanged = insight.name !== row.name;
                    const descriptionChanged = insight.description !== row.description;
                    if (nameChanged || descriptionChanged) {
                        this.logger.info(`${this.dryRun ? '[dry-run] ' : ''}Update ${insight.variableName} (${insight.id})`);
                        if (nameChanged)
                            this.logger.info(`  name: ${insight.name} -> ${row.name}`);
                        if (descriptionChanged) {
                            this.logger.info(`  description: ${insight.description} -> ${row.description}`);
                        }
                        if (!this.dryRun) {
                            insight.merge({ name: row.name, description: row.description });
                            await insight.save();
                            await this.upsertInsightTranslations(insight.id, row.name, row.description);
                        }
                        updated += 1;
                    }
                    else if (!this.dryRun) {
                        await this.upsertInsightTranslations(insight.id, row.name, row.description);
                        unchanged += 1;
                    }
                    else {
                        unchanged += 1;
                    }
                }
                if (!insight || this.dryRun)
                    continue;
                const alreadyLinked = insight.clubs?.some((clubRow) => clubRow.id === HAMBURG_CLUB_ID);
                if (alreadyLinked)
                    continue;
                const existingLink = await db
                    .connection('pg')
                    .from('club_insights')
                    .where('club_id', HAMBURG_CLUB_ID)
                    .where('insight_id', insight.id)
                    .first();
                if (existingLink)
                    continue;
                await db.connection('pg').table('club_insights').insert({
                    club_id: HAMBURG_CLUB_ID,
                    insight_id: insight.id,
                });
                linked += 1;
            }
        };
        await persist();
        this.logger.info(`${this.dryRun ? 'Would apply' : 'Applied'}: created ${created}, updated ${updated}, unchanged ${unchanged}, linked ${linked}`);
    }
    resolveInsight(row, byId, byVariable) {
        if (row.insightId) {
            const byInsightId = byId.get(row.insightId);
            if (byInsightId)
                return byInsightId;
        }
        const matches = byVariable.get(row.variable) ?? [];
        if (matches.length === 0)
            return null;
        if (matches.length === 1)
            return matches[0];
        const hamburgMatch = matches.find((insight) => insight.clubs.some((club) => club.id === HAMBURG_CLUB_ID));
        return hamburgMatch ?? matches[0];
    }
    async createInsight(row) {
        const payload = {
            variable_name: row.variable,
            name: row.name,
            description: row.description,
            can_too_high: false,
            can_too_low: false,
            treshold_type: INSIGHT_TRESHOLD_TYPE.ABSOLUTE,
        };
        if (row.insightId)
            payload.id = row.insightId;
        const inserted = await db.connection('pg').table('insights').insert(payload).returning('id');
        const id = inserted[0]?.id ?? inserted[0];
        const insight = await Insight.findOrFail(id);
        await insight.load('clubs');
        return insight;
    }
    async upsertInsightTranslations(insightId, name, description) {
        await Translation.updateOrCreate({
            language: APP_LANGUAGES.EN,
            translatableType: TRANSLATABLE_TYPES.INSIGHT,
            translatableId: insightId,
            key: TRANSLATION_KEYS.INSIGHT_NAME,
        }, { value: name });
        await Translation.updateOrCreate({
            language: APP_LANGUAGES.EN,
            translatableType: TRANSLATABLE_TYPES.INSIGHT,
            translatableId: insightId,
            key: TRANSLATION_KEYS.INSIGHT_DESCRIPTION,
        }, { value: description });
        const frenchRows = await Translation.query()
            .where('translatableType', TRANSLATABLE_TYPES.INSIGHT)
            .where('translatableId', insightId)
            .where('language', APP_LANGUAGES.FR)
            .whereIn('key', [TRANSLATION_KEYS.INSIGHT_NAME, TRANSLATION_KEYS.INSIGHT_DESCRIPTION]);
        for (const translation of frenchRows) {
            const nextValue = translation.key === TRANSLATION_KEYS.INSIGHT_NAME ? name : description;
            if (translation.value === nextValue)
                continue;
            translation.value = nextValue;
            await translation.save();
        }
    }
    async parseCsv() {
        const csvPath = this.app.makePath(CSV_RELATIVE_PATH);
        const content = await readFile(csvPath, 'utf8');
        const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
        const rows = [];
        for (const line of lines.slice(1)) {
            const parts = line.split(';');
            if (parts.length < 7)
                continue;
            const variable = parts[1]?.trim();
            const name = parts[2]?.trim();
            const insightId = parts[parts.length - 3]?.trim() || null;
            const description = parts.slice(3, parts.length - 3).join(';').trim();
            if (!variable || !name || !description)
                continue;
            rows.push({ variable, name, description, insightId });
        }
        return rows;
    }
}
__decorate([
    flags.boolean({ description: 'Preview changes without writing to the database' }),
    __metadata("design:type", Boolean)
], HambourgUpdateInsightTexts.prototype, "dryRun", void 0);
//# sourceMappingURL=hambourg_update_insight_texts.js.map