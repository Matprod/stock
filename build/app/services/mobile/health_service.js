import HealthPain from '#models_pg/health_pain';
import HealthRating from '#models_pg/health_rating';
import AthleteService from '#services/athlete_service';
import { SubjectiveScaleValuesService } from '#services/subjective_scale_values_service';
import { DateTime } from 'luxon';
import DiscomfortLocation from '#models_pg/pain_discomfort_location';
import { TRANSLATABLE_TYPES, TRANSLATION_KEYS } from '#constants/translation.constants';
import { TranslationService } from '#services/translation_service';
export default class HealthService {
    athleteService = new AthleteService();
    translationService = new TranslationService();
    subjectiveScaleValuesService = new SubjectiveScaleValuesService();
    async getHealth(athleteId, dateOfDay) {
        return HealthRating.query()
            .whereHas('day', (query) => {
            query.where('athleteId', athleteId).where('dateOfDay', dateOfDay);
        })
            .preload('pains', (painsQuery) => painsQuery.preload('location'))
            .first();
    }
    async addOrUpdateHealth(athleteId, dateOfDay, options) {
        const day = await this.athleteService.getOrCreateDay(athleteId, DateTime.fromJSDate(dateOfDay));
        const health = await HealthRating.updateOrCreate({ dayId: day.id }, { dayId: day.id });
        const pains = options.pains ?? [];
        const painLocationIds = pains.map((p) => p.location);
        await HealthPain.query()
            .where('healthId', health.id)
            .if(painLocationIds.length > 0, (q) => q.whereNotIn('locationId', painLocationIds))
            .delete();
        if (pains.length) {
            await HealthPain.updateOrCreateMany(['healthId', 'locationId'], pains.map((p) => ({ healthId: health.id, locationId: p.location, rating: p.rating })));
        }
        await this.subjectiveScaleValuesService.applyHealth(health, options.clubScales, {
            ratings: options.ratings,
            metrics: options.metrics,
        });
        await health.load('pains', (painsQuery) => painsQuery.preload('location'));
        return health;
    }
    async buildHealthResponse(health, clubScales) {
        await health.load('metricValues', (query) => query.preload('metric'));
        const { ratings, metrics } = this.subjectiveScaleValuesService.readHealthSplit(health, clubScales);
        return {
            id: health.id,
            ratings,
            metrics,
            pains: health.pains?.map((pain) => pain.serialize()) ?? [],
        };
    }
    async getDiscomfortLocations(language) {
        const locations = await DiscomfortLocation.query().preload('zone').orderBy('name');
        await this.translationService.applyTranslatedNames(locations.filter((location) => location.name != null), TRANSLATABLE_TYPES.PAIN_DISCOMFORT_LOCATION, TRANSLATION_KEYS.PAIN_DISCOMFORT_LOCATION_NAME, language);
        return locations;
    }
    async translatePainLocations(locations, language) {
        await this.translationService.applyTranslatedNames(locations.filter((location) => location != null && location.name != null), TRANSLATABLE_TYPES.PAIN_DISCOMFORT_LOCATION, TRANSLATION_KEYS.PAIN_DISCOMFORT_LOCATION_NAME, language);
    }
    async getRecentFoodSupplements(_athleteId) {
        return [];
    }
    async getUtilities(_athleteId, language) {
        const painLocations = await this.getDiscomfortLocations(language);
        return {
            foodSupplementNames: [],
            painLocations,
            recentFoodSupplements: [],
        };
    }
}
//# sourceMappingURL=health_service.js.map