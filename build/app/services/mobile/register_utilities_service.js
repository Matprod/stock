import Sport from '#models_pg/sport';
import DiscomfortLocation from '#models_pg/pain_discomfort_location';
import InjuryZone from '#models_pg/zone';
import { TRANSLATABLE_TYPES, TRANSLATION_KEYS } from '#constants/translation.constants';
import { TranslationService } from '#services/translation_service';
export default class RegisterUtilitiesService {
    translationService = new TranslationService();
    async getSports() {
        const sports = await Sport.query().orderBy('name');
        return sports;
    }
    async getZones() {
        const zonesFront = await InjuryZone.query().where('side', 'front');
        const zonesBack = await InjuryZone.query().where('side', 'back');
        return {
            frontZones: zonesFront,
            backZones: zonesBack,
        };
    }
    async getPainZones(language) {
        const locations = await DiscomfortLocation.query().preload('zone');
        await this.translationService.applyTranslatedNames(locations.filter((location) => location.name != null), TRANSLATABLE_TYPES.PAIN_DISCOMFORT_LOCATION, TRANSLATION_KEYS.PAIN_DISCOMFORT_LOCATION_NAME, language);
        const frontPainZones = locations.filter((location) => location.zone?.side === 'front');
        const backPainZones = locations.filter((location) => location.zone?.side === 'back');
        return {
            frontPainZones,
            backPainZones,
        };
    }
    async getRegisterUtilities(language) {
        const [sports, zones, painZones] = await Promise.all([
            this.getSports(),
            this.getZones(),
            this.getPainZones(language),
        ]);
        return {
            sports,
            frontZones: zones.frontZones,
            backZones: zones.backZones,
            frontPainZones: painZones.frontPainZones,
            backPainZones: painZones.backPainZones,
        };
    }
}
//# sourceMappingURL=register_utilities_service.js.map