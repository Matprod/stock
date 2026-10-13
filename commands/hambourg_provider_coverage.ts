import { ATHLETE_PROVIDER_TYPES } from '#constants/athlete_provider.constants'
import { HAMBOURG_CLUB_ID } from '#constants/hambourg.constants'
import Athlete from '#models_pg/athlete'
import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { DateTime } from 'luxon'

export default class HambourgProviderCoverage extends BaseCommand {
  static commandName = 'hambourg:provider-coverage'
  static description = 'Compare SAP / SkillCorner / DFL athlete_providers for Hamburg athletes'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const today = DateTime.utc().startOf('day')
    const athletes = await Athlete.query()
      .where('clubId', HAMBOURG_CLUB_ID)
      .preload('athleteProviders')
      .orderBy('lastName', 'asc')
      .orderBy('firstName', 'asc')

    const active = athletes.filter((athlete) => !athlete.endDate || athlete.endDate >= today)

    const hasProvider = (athlete: Athlete, provider: string) =>
      athlete.athleteProviders.some(
        (row) => row.provider === provider && Boolean(row.providerAthleteId)
      )

    const printGroup = (title: string, rows: Athlete[]) => {
      console.log('')
      console.log(`${title} (${rows.length})`)
      const sap = rows.filter((athlete) => hasProvider(athlete, ATHLETE_PROVIDER_TYPES.SAP)).length
      const skillcorner = rows.filter((athlete) =>
        hasProvider(athlete, ATHLETE_PROVIDER_TYPES.SKILLCORNER)
      ).length
      const dfl = rows.filter((athlete) => hasProvider(athlete, ATHLETE_PROVIDER_TYPES.DFL)).length
      const both = rows.filter(
        (athlete) =>
          hasProvider(athlete, ATHLETE_PROVIDER_TYPES.SKILLCORNER) &&
          hasProvider(athlete, ATHLETE_PROVIDER_TYPES.DFL)
      ).length
      const onlySk = rows.filter(
        (athlete) =>
          hasProvider(athlete, ATHLETE_PROVIDER_TYPES.SKILLCORNER) &&
          !hasProvider(athlete, ATHLETE_PROVIDER_TYPES.DFL)
      )
      const onlyDfl = rows.filter(
        (athlete) =>
          hasProvider(athlete, ATHLETE_PROVIDER_TYPES.DFL) &&
          !hasProvider(athlete, ATHLETE_PROVIDER_TYPES.SKILLCORNER)
      )
      const neither = rows.filter(
        (athlete) =>
          !hasProvider(athlete, ATHLETE_PROVIDER_TYPES.SKILLCORNER) &&
          !hasProvider(athlete, ATHLETE_PROVIDER_TYPES.DFL)
      )

      console.log(`  SAP=${sap}  SkillCorner=${skillcorner}  DFL=${dfl}  both SK+DFL=${both}`)
      if (onlySk.length) {
        console.log('  SkillCorner only:')
        for (const athlete of onlySk) {
          console.log(`    ${athlete.firstName} ${athlete.lastName}`)
        }
      }
      if (onlyDfl.length) {
        console.log('  DFL only:')
        for (const athlete of onlyDfl) {
          console.log(`    ${athlete.firstName} ${athlete.lastName}`)
        }
      }
      if (neither.length) {
        console.log('  Neither SkillCorner nor DFL:')
        for (const athlete of neither) {
          const sapId = athlete.athleteProviders.find(
            (row) => row.provider === ATHLETE_PROVIDER_TYPES.SAP
          )?.providerAthleteId
          console.log(`    ${athlete.firstName} ${athlete.lastName}${sapId ? ` sap=${sapId}` : ''}`)
        }
      }
    }

    console.log(`Hamburg athletes total=${athletes.length} active(no endDate or >= today)=${active.length}`)
    printGroup('All Hamburg athletes', athletes)
    printGroup('Active Hamburg athletes', active)
    console.log('')
  }
}
