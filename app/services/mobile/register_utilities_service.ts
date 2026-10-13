import Sport from '#models_pg/sport'
import DiscomfortLocation from '#models_pg/pain_discomfort_location'
import InjuryZone from '#models_pg/zone'
import { TRANSLATABLE_TYPES, TRANSLATION_KEYS } from '#constants/translation.constants'
import { TranslationService } from '#services/translation_service'
import type { AppLanguage } from '#utils/localize'

export default class RegisterUtilitiesService {
  private translationService = new TranslationService()

  public async getSports() {
    const sports = await Sport.query().orderBy('name')
    return sports
  }

  public async getZones() {
    const zonesFront = await InjuryZone.query().where('side', 'front')
    const zonesBack = await InjuryZone.query().where('side', 'back')

    return {
      frontZones: zonesFront,
      backZones: zonesBack,
    }
  }

  public async getPainZones(language: AppLanguage) {
    const locations = await DiscomfortLocation.query().preload('zone')
    await this.translationService.applyTranslatedNames(
      locations.filter(
        (location): location is DiscomfortLocation & { name: string } => location.name != null
      ),
      TRANSLATABLE_TYPES.PAIN_DISCOMFORT_LOCATION,
      TRANSLATION_KEYS.PAIN_DISCOMFORT_LOCATION_NAME,
      language
    )

    const frontPainZones = locations.filter((location) => location.zone?.side === 'front')
    const backPainZones = locations.filter((location) => location.zone?.side === 'back')

    return {
      frontPainZones,
      backPainZones,
    }
  }

  public async getRegisterUtilities(language: AppLanguage) {
    const [sports, zones, painZones] = await Promise.all([
      this.getSports(),
      this.getZones(),
      this.getPainZones(language),
    ])

    return {
      sports,
      frontZones: zones.frontZones,
      backZones: zones.backZones,
      frontPainZones: painZones.frontPainZones,
      backPainZones: painZones.backPainZones,
    }
  }
}
