import Athlete from '#models_pg/athlete';
import Biomarker from '#models_pg/biomarker';
import BiomarkerType from '#models_pg/biomarker_type';
import { TRANSLATABLE_TYPES, TRANSLATION_KEYS } from '#constants/translation.constants';
import { TranslationService } from '#services/translation_service';
import { DateTime } from 'luxon';
const BIOMARKERS_CURSOR_PAGE_SIZE = 20;
export default class BiomarkerService {
    translationService;
    constructor() {
        this.translationService = new TranslationService();
    }
    async getBiomarkerTypes(clubId, language) {
        const biomarkerTypes = await BiomarkerType.query()
            .where((query) => {
            query.doesntHave('clubs').orWhereHas('clubs', (clubQuery) => {
                clubQuery.where('clubs.id', clubId);
            });
        })
            .orderBy('name', 'asc');
        this.applyBiomarkerTypeDisplayNames(biomarkerTypes);
        await this.applyBiomarkerTypeTranslations(biomarkerTypes, language);
        return biomarkerTypes;
    }
    async getBiomarkersByClub(clubId, language, filters, seasonStartDate, seasonEndDate) {
        const biomarkersQuery = Biomarker.query()
            .whereHas('athlete', (athleteQuery) => {
            athleteQuery.where('clubId', clubId);
            if (seasonStartDate && seasonEndDate) {
                const seasonStart = seasonStartDate.toJSDate();
                const seasonEnd = seasonEndDate.toJSDate();
                athleteQuery
                    .where((query) => {
                    query.whereNull('startDate').orWhere('startDate', '<=', seasonEnd);
                })
                    .where((query) => {
                    query.whereNull('endDate').orWhere('endDate', '>=', seasonStart);
                });
            }
        })
            .orderBy('measuredAt', 'desc')
            .orderBy('id', 'desc')
            .limit(BIOMARKERS_CURSOR_PAGE_SIZE)
            .offset(filters?.cursor ?? 0)
            .preload('biomarkerType')
            .preload('athlete', (athleteQuery) => {
            athleteQuery.select('id', 'firstName', 'lastName').preload('profilePicture');
        });
        if (filters?.athleteId) {
            biomarkersQuery.where('athleteId', filters.athleteId);
        }
        if (filters?.biomarkerTypeId) {
            biomarkersQuery.where('biomarkerTypeId', filters.biomarkerTypeId);
        }
        if (filters?.from) {
            const fromDate = DateTime.fromISO(filters.from).startOf('day');
            if (fromDate.isValid) {
                biomarkersQuery.where('measuredAt', '>=', fromDate.toJSDate());
            }
        }
        if (filters?.to) {
            const toDate = DateTime.fromISO(filters.to).endOf('day');
            if (toDate.isValid) {
                biomarkersQuery.where('measuredAt', '<=', toDate.toJSDate());
            }
        }
        const biomarkers = await biomarkersQuery;
        this.applyBiomarkerTypeDisplayNames(biomarkers.map((biomarker) => biomarker.biomarkerType).filter(Boolean));
        await this.applyBiomarkerTypeTranslations(biomarkers.map((biomarker) => biomarker.biomarkerType).filter(Boolean), language);
        const currentOffset = filters?.cursor ?? 0;
        const nextCursor = biomarkers.length === BIOMARKERS_CURSOR_PAGE_SIZE
            ? currentOffset + BIOMARKERS_CURSOR_PAGE_SIZE
            : null;
        return {
            data: biomarkers,
            meta: { nextCursor },
        };
    }
    async updateBiomarker({ id, athleteId, biomarkerTypeId, value, measuredAt, clubId, language, }) {
        const athlete = await Athlete.query().where('id', athleteId).where('clubId', clubId).first();
        if (!athlete) {
            throw new Error('Athlete not found');
        }
        const biomarkerType = await BiomarkerType.query()
            .where('id', biomarkerTypeId)
            .where((query) => {
            query.doesntHave('clubs').orWhereHas('clubs', (clubQuery) => {
                clubQuery.where('clubs.id', clubId);
            });
        })
            .first();
        if (!biomarkerType) {
            throw new Error('Biomarker type not found');
        }
        const biomarker = await Biomarker.query()
            .where('id', id)
            .whereHas('athlete', (athleteQuery) => {
            athleteQuery.where('clubId', clubId);
        })
            .first();
        if (!biomarker) {
            throw new Error('Biomarker not found');
        }
        biomarker.merge({
            athleteId,
            biomarkerTypeId,
            value,
            measuredAt: DateTime.fromJSDate(measuredAt),
        });
        await biomarker.save();
        await biomarker.load('biomarkerType');
        this.applyBiomarkerTypeDisplayNames([biomarker.biomarkerType]);
        await this.applyBiomarkerTypeTranslations([biomarker.biomarkerType], language);
        return biomarker;
    }
    async createBiomarkers({ biomarkers, clubId, }) {
        const athleteIds = [...new Set(biomarkers.map((biomarker) => biomarker.athleteId))];
        const biomarkerTypeIds = [...new Set(biomarkers.map((biomarker) => biomarker.biomarkerTypeId))];
        const athletes = await Athlete.query().whereIn('id', athleteIds).where('clubId', clubId);
        if (athletes.length !== athleteIds.length) {
            throw new Error('Athlete not found');
        }
        const biomarkerTypes = await BiomarkerType.query()
            .whereIn('id', biomarkerTypeIds)
            .where((query) => {
            query.doesntHave('clubs').orWhereHas('clubs', (clubQuery) => {
                clubQuery.where('clubs.id', clubId);
            });
        });
        if (biomarkerTypes.length !== biomarkerTypeIds.length) {
            throw new Error('Biomarker type not found');
        }
        const created = await Biomarker.createMany(biomarkers.map((biomarker) => ({
            athleteId: biomarker.athleteId,
            biomarkerTypeId: biomarker.biomarkerTypeId,
            value: biomarker.value,
            measuredAt: DateTime.fromJSDate(biomarker.measuredAt),
        })));
        return { count: created.length };
    }
    async deleteBiomarker(id, clubId) {
        const biomarker = await Biomarker.query()
            .where('id', id)
            .whereHas('athlete', (athleteQuery) => {
            athleteQuery.where('clubId', clubId);
        })
            .first();
        if (!biomarker) {
            throw new Error('Biomarker not found');
        }
        await biomarker.delete();
        return { success: true };
    }
    applyBiomarkerTypeDisplayNames(biomarkerTypes) {
        for (const type of biomarkerTypes) {
            const label = type.displayName?.trim();
            if (label)
                type.name = label;
        }
    }
    async applyBiomarkerTypeTranslations(biomarkerTypes, language) {
        await this.translationService.applyTranslatedNames(biomarkerTypes, TRANSLATABLE_TYPES.BIOMARKER_TYPE, TRANSLATION_KEYS.BIOMARKER_TYPE_NAME, language);
    }
}
//# sourceMappingURL=biomarker_service.js.map