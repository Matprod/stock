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
import { DFL_API_CONFIG, DFL_SERVICES } from '#constants/dfl.constants';
import { HAMBOURG_CLUB_ID } from '#constants/hambourg.constants';
import Athlete from '#models_pg/athlete';
import AthleteProvider from '#models_pg/athlete_provider';
import { DflService } from '#services/dfl_service';
import { findAll, parseXml } from '#utils/dfl_xml';
import { BaseCommand, flags } from '@adonisjs/core/ace';
const PERSON_ID_KEYS = ['PersonId', 'PlayerId', 'ObjectId'];
const FIRST_NAME_KEYS = ['FirstName', 'Firstname', 'Vorname'];
const LAST_NAME_KEYS = ['LastName', 'Lastname', 'Name', 'PlayingName', 'Nachname'];
const SHIRT_KEYS = ['ShirtNumber', 'ShirtNo', 'Trikotnummer'];
const attr = (node, keys) => {
    for (const key of keys) {
        const value = node.attrs[key]?.trim();
        if (value)
            return value;
    }
    return '';
};
const collectPersons = (xml, clubId) => {
    const root = parseXml(xml);
    const byId = new Map();
    const ingest = (node) => {
        const personId = attr(node, PERSON_ID_KEYS);
        if (!personId)
            return;
        const existing = byId.get(personId);
        if (existing) {
            existing.matches++;
            if (!existing.firstName)
                existing.firstName = attr(node, FIRST_NAME_KEYS);
            if (!existing.lastName)
                existing.lastName = attr(node, LAST_NAME_KEYS);
            if (!existing.shirtNumber)
                existing.shirtNumber = attr(node, SHIRT_KEYS);
            return;
        }
        byId.set(personId, {
            personId,
            firstName: attr(node, FIRST_NAME_KEYS),
            lastName: attr(node, LAST_NAME_KEYS),
            shirtNumber: attr(node, SHIRT_KEYS),
            matches: 1,
        });
    };
    const walkClubTeam = (node) => {
        if (node.name === 'Player' || node.name === 'Person')
            ingest(node);
        for (const child of node.children)
            walkClubTeam(child);
    };
    for (const team of findAll(root, 'Team')) {
        const teamId = team.attrs.TeamId ?? team.attrs.ClubId ?? null;
        if (teamId !== clubId)
            continue;
        walkClubTeam(team);
    }
    if (byId.size === 0) {
        for (const node of [...findAll(root, 'Player'), ...findAll(root, 'Person')]) {
            const teamId = node.attrs.TeamId ?? node.attrs.ClubId ?? null;
            if (teamId !== clubId)
                continue;
            ingest(node);
        }
    }
    return [...byId.values()];
};
const normalizeName = (value) => value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
const nameKey = (firstName, lastName) => `${normalizeName(firstName)}|${normalizeName(lastName)}`;
export default class DflUnmapped extends BaseCommand {
    static commandName = 'dfl:unmapped';
    static description = 'List DFL PersonIds seen in recent matches that have no athlete_providers.dfl row';
    static options = {
        startApp: true,
    };
    async run() {
        const service = await DflService.fromClubId(this.clubId || HAMBOURG_CLUB_ID);
        const dflClubId = service.dflClubId;
        const fixtures = await service.listPlayedFixtures(this.matches);
        this.logger.info(`played matches scanned: ${fixtures.length}`);
        const fromMatches = new Map();
        for (const fixture of fixtures) {
            const xml = await service.pullFeed(DFL_SERVICES.matchInfo, fixture.matchId);
            for (const person of collectPersons(xml, dflClubId)) {
                const existing = fromMatches.get(person.personId);
                if (existing) {
                    existing.matches++;
                    if (!existing.firstName)
                        existing.firstName = person.firstName;
                    if (!existing.lastName)
                        existing.lastName = person.lastName;
                    if (!existing.shirtNumber)
                        existing.shirtNumber = person.shirtNumber;
                }
                else {
                    fromMatches.set(person.personId, { ...person, matches: 1 });
                }
            }
            await new Promise((resolve) => setTimeout(resolve, DFL_API_CONFIG.interCallDelayMs));
        }
        const providers = await AthleteProvider.query()
            .where('provider', ATHLETE_PROVIDER_TYPES.DFL)
            .whereNotNull('providerAthleteId')
            .preload('athlete', (query) => query.where('clubId', service.maunaClubId));
        const mappedIds = new Set(providers
            .filter((provider) => provider.providerAthleteId && provider.athlete)
            .map((provider) => String(provider.providerAthleteId)));
        const clubAthletes = await Athlete.query().where('clubId', service.maunaClubId);
        const athletesByName = new Map();
        for (const athlete of clubAthletes) {
            const key = nameKey(athlete.firstName, athlete.lastName);
            const list = athletesByName.get(key) ?? [];
            list.push(athlete);
            athletesByName.set(key, list);
        }
        const roster = [...fromMatches.values()];
        roster.sort((a, b) => b.matches - a.matches || a.lastName.localeCompare(b.lastName));
        const unmapped = roster.filter((person) => !mappedIds.has(person.personId));
        const mapped = roster.filter((person) => mappedIds.has(person.personId));
        console.log('');
        console.log(`DFL club=${dflClubId} mauna_club=${service.maunaClubId}`);
        console.log(`Mapped providers in DB: ${mappedIds.size}`);
        console.log(`Seen in scan: ${roster.length} (mapped ${mapped.length}, unmapped ${unmapped.length})`);
        console.log('');
        if (unmapped.length === 0) {
            this.logger.success('No unmapped DFL PersonIds in this scan');
            return;
        }
        console.log('Unmapped DFL players');
        for (const person of unmapped) {
            const key = nameKey(person.firstName, person.lastName);
            const nameHits = key === '|' ? [] : (athletesByName.get(key) ?? []);
            const lastHits = person.lastName && !nameHits.length
                ? clubAthletes.filter((athlete) => normalizeName(athlete.lastName) === normalizeName(person.lastName))
                : [];
            const guess = nameHits.length === 1
                ? `name-match ${nameHits[0].firstName} ${nameHits[0].lastName} (${nameHits[0].id})`
                : lastHits.length === 1
                    ? `lastname-match ${lastHits[0].firstName} ${lastHits[0].lastName} (${lastHits[0].id})`
                    : nameHits.length > 1
                        ? `ambiguous name (${nameHits.length})`
                        : lastHits.length > 1
                            ? `ambiguous lastname (${lastHits.length})`
                            : 'no DB name match';
            const label = `${person.firstName} ${person.lastName}`.trim() || '(no name in XML)';
            const shirt = person.shirtNumber ? ` #${person.shirtNumber}` : '';
            console.log(`  ${label}${shirt}  personId=${person.personId}  matches=${person.matches}  → ${guess}`);
        }
        console.log('');
    }
}
__decorate([
    flags.string({
        description: 'Mauna club id (or DFL-CLU-* for legacy)',
        default: HAMBOURG_CLUB_ID,
    }),
    __metadata("design:type", String)
], DflUnmapped.prototype, "clubId", void 0);
__decorate([
    flags.number({
        description: 'Latest played matches to scan (0 = all from import min date)',
        default: 5,
    }),
    __metadata("design:type", Number)
], DflUnmapped.prototype, "matches", void 0);
//# sourceMappingURL=dfl_unmapped.js.map