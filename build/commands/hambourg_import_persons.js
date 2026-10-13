var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ATHLETE_PROVIDER_TYPES } from '#constants/athlete_provider.constants';
import { DIAGNOSTIK_FILE, HAMBOURG_CLUB_ID, SAPSPORTSONE_QUEST_PERSONS_FILE, } from '#constants/hambourg.constants';
import AthleteProvider from '#models_pg/athlete_provider';
import { loadLatestHeightsFromDiagnostik, parseQuestPersonsCsv, } from '#services/hambourg/sap_persons';
import { BaseCommand, flags } from '@adonisjs/core/ace';
import { join } from 'node:path';
function sameDate(current, next) {
    if (!current)
        return false;
    return current.toISODate() === next.toISODate();
}
export default class HambourgImportPersons extends BaseCommand {
    static commandName = 'hambourg:import-persons';
    static description = 'Update Hamburg athletes birthDate/gender from sapsportsone_quest_persons.csv and heightCm from diagnostik.xlsx';
    static options = {
        startApp: true,
    };
    async run() {
        const personsPath = this.file.startsWith('/')
            ? this.file
            : join(process.cwd(), this.file.replace(/^\.\//, ''));
        const diagnostikPath = this.diagnostik.startsWith('/')
            ? this.diagnostik
            : join(process.cwd(), this.diagnostik.replace(/^\.\//, ''));
        const persons = parseQuestPersonsCsv(personsPath);
        const heights = await loadLatestHeightsFromDiagnostik(diagnostikPath);
        const providers = await AthleteProvider.query()
            .where('provider', ATHLETE_PROVIDER_TYPES.SAP)
            .whereNotNull('providerAthleteId')
            .preload('athlete', (athleteQuery) => {
            athleteQuery.where('clubId', HAMBOURG_CLUB_ID);
        });
        const athletes = providers
            .filter((provider) => provider.providerAthleteId && provider.athlete)
            .map((provider) => ({
            personId: provider.providerAthleteId.trim().toUpperCase(),
            athlete: provider.athlete,
        }));
        let birthUpdated = 0;
        let genderUpdated = 0;
        let heightUpdated = 0;
        let unchanged = 0;
        let missingPerson = 0;
        const samples = [];
        const missingPersonIds = [];
        for (const { personId, athlete } of athletes) {
            const person = persons.get(personId);
            if (!person) {
                missingPerson++;
                missingPersonIds.push(`${athlete.firstName} ${athlete.lastName} personId=${personId}`);
                continue;
            }
            const heightCm = heights.get(personId) ?? null;
            const updates = {};
            if (person.birthday && !sameDate(athlete.birthDate, person.birthday)) {
                updates.birthDate = person.birthday;
                birthUpdated++;
            }
            if (person.gender && athlete.gender !== person.gender) {
                updates.gender = person.gender;
                genderUpdated++;
            }
            if (heightCm !== null && athlete.heightCm !== heightCm) {
                updates.heightCm = heightCm;
                heightUpdated++;
            }
            const nextBirth = updates.birthDate ?? athlete.birthDate;
            const nextHeight = updates.heightCm ?? athlete.heightCm;
            const label = `${athlete.firstName} ${athlete.lastName}: birth=${nextBirth?.toISODate() ?? '—'} height=${nextHeight ?? '—'}cm`;
            if (Object.keys(updates).length === 0) {
                unchanged++;
                continue;
            }
            if (samples.length < this.show)
                samples.push(label);
            if (!this.dryRun) {
                athlete.merge(updates);
                await athlete.save();
            }
        }
        const withBirthday = [...persons.values()].filter((person) => person.birthday).length;
        console.log('');
        console.log(`Persons CSV: ${personsPath}${this.dryRun ? ' (dry-run)' : ''}`);
        console.log(`Persons: ${persons.size} (with birthday: ${withBirthday})`);
        console.log(`Diagnostik heights: ${heights.size}`);
        console.log(`Hamburg SAP athletes: ${athletes.length}`);
        console.log(`Missing in persons CSV: ${missingPerson}`);
        console.log(`Updated: birthDate=${birthUpdated} gender=${genderUpdated} heightCm=${heightUpdated} unchanged=${unchanged}`);
        if (samples.length > 0) {
            console.log('');
            console.log(`Samples (showing ${samples.length})`);
            for (const sample of samples) {
                console.log(`  - ${sample}`);
            }
        }
        if (missingPersonIds.length > 0) {
            console.log('');
            console.log(`Missing persons (showing ${Math.min(this.show, missingPersonIds.length)}/${missingPersonIds.length})`);
            for (const row of missingPersonIds.slice(0, this.show)) {
                console.log(`  - ${row}`);
            }
        }
        console.log('');
        if (this.dryRun) {
            this.logger.info(`Dry run: would update birthDate=${birthUpdated} gender=${genderUpdated} heightCm=${heightUpdated}`);
        }
        else {
            this.logger.success(`Updated birthDate=${birthUpdated} gender=${genderUpdated} heightCm=${heightUpdated}`);
        }
    }
}
__decorate([
    flags.string({
        description: 'Path to SAP quest persons CSV',
        default: SAPSPORTSONE_QUEST_PERSONS_FILE,
    }),
    __metadata("design:type", String)
], HambourgImportPersons.prototype, "file", void 0);
__decorate([
    flags.string({
        description: 'Path to diagnostik xlsx (Height column)',
        default: DIAGNOSTIK_FILE,
    }),
    __metadata("design:type", String)
], HambourgImportPersons.prototype, "diagnostik", void 0);
__decorate([
    flags.boolean({
        description: 'Preview updates without writing',
    }),
    __metadata("design:type", Boolean)
], HambourgImportPersons.prototype, "dryRun", void 0);
__decorate([
    flags.number({
        description: 'Number of sample updates to print',
        default: 20,
    }),
    __metadata("design:type", Number)
], HambourgImportPersons.prototype, "show", void 0);
//# sourceMappingURL=hambourg_import_persons.js.map