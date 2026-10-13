import { DateTime } from 'luxon'
import Injury from '#models_pg/injury'
import Athlete from '#models_pg/athlete'
import type { InjuryHistoryVariables } from '#contracts/sunderland'
import { calculateInjuryDuration, classifyInjurySeverity } from '../../../utils/injury_severity.js'
import Disease from '#models_pg/disease'

const SUNDERLAND_SEASONS: Array<{ name: string; startDate: DateTime; endDate: DateTime }> = [
  {
    name: '2020-2021',
    startDate: DateTime.fromISO('2020-06-01'),
    endDate: DateTime.fromISO('2021-05-31'),
  },
  {
    name: '2021-2022',
    startDate: DateTime.fromISO('2021-06-01'),
    endDate: DateTime.fromISO('2022-05-31'),
  },
  {
    name: '2022-2023',
    startDate: DateTime.fromISO('2022-06-01'),
    endDate: DateTime.fromISO('2023-05-31'),
  },
  {
    name: '2023-2024',
    startDate: DateTime.fromISO('2023-06-01'),
    endDate: DateTime.fromISO('2024-05-31'),
  },
  {
    name: '2024-2025',
    startDate: DateTime.fromISO('2024-06-01'),
    endDate: DateTime.fromISO('2025-05-31'),
  },
  {
    name: '2025-2026',
    startDate: DateTime.fromISO('2025-06-01'),
    endDate: DateTime.fromISO('2026-05-31'),
  },
  {
    name: '2026-2027',
    startDate: DateTime.fromISO('2026-06-01'),
    endDate: DateTime.fromISO('2027-05-31'),
  },
]

export default class InjuryHistoryService {
  private getSeasonForDate(date: DateTime): string | null {
    return SUNDERLAND_SEASONS.find((s) => date >= s.startDate && date <= s.endDate)?.name || null
  }

  public async calculateInjuryHistoryVariables(
    athleteId: string,
    currentDate: DateTime,
    currentSeason: string
  ): Promise<InjuryHistoryVariables> {
    const athlete = await Athlete.query()
      .where('id', athleteId)
      .preload('club', (clubQuery) => {
        clubQuery.preload('seasons', (seasonsQuery) => {
          seasonsQuery.orderBy('startDate', 'desc')
        })
      })
      .first()

    if (!athlete || !athlete.club?.seasons) {
      return this.getDefaultValues()
    }

    const allInjuries = await Injury.query()
      .where('athleteId', athleteId)
      .whereNotNull('dateOfInjury')
      .orderBy('dateOfInjury', 'desc')

    const allDiseases = await Disease.query()
      .where('athleteId', athleteId)
      .whereNotNull('startDate')
      .orderBy('startDate', 'desc')

    const currentSeasonInjuries: Injury[] = []
    const currentSeasonDiseases: Disease[] = []
    const pastSeasonInjuries: Injury[] = []
    const pastSeasonDiseases: Disease[] = []
    const allInjuriesBeforeDate: Injury[] = []
    const allDiseasesBeforeDate: Disease[] = []
    const pastSeasonsWithInjuries: Set<(typeof SUNDERLAND_SEASONS)[number]['name']> = new Set()

    for (const injury of allInjuries) {
      if (!injury.dateOfInjury) continue
      const injurySeason = this.getSeasonForDate(injury.dateOfInjury)

      if (injury.dateOfInjury < currentDate) {
        allInjuriesBeforeDate.push(injury)

        if (injurySeason === currentSeason) {
          currentSeasonInjuries.push(injury)
        } else if (injurySeason && injurySeason !== currentSeason) {
          pastSeasonInjuries.push(injury)
          pastSeasonsWithInjuries.add(injurySeason)
        }
      }
    }

    for (const disease of allDiseases) {
      if (!disease.startDate) continue
      const diseaseSeason = this.getSeasonForDate(disease.startDate)

      if (disease.startDate <= currentDate) {
        allDiseasesBeforeDate.push(disease)

        if (diseaseSeason === currentSeason) {
          currentSeasonDiseases.push(disease)
        } else if (diseaseSeason && diseaseSeason !== currentSeason) {
          pastSeasonDiseases.push(disease)
          pastSeasonsWithInjuries.add(diseaseSeason)
        }
      }
    }

    const classifiedInjuries = allInjuriesBeforeDate.map((injury) => {
      const duration = calculateInjuryDuration(
        injury.dateOfInjury!,
        injury.recoveryDate,
        currentDate
      )
      const severity = classifyInjurySeverity(injury.pathology, duration)
      return { injury, severity }
    })

    const currentSeasonClassified = classifiedInjuries.filter(({ injury }) => {
      const injurySeason = this.getSeasonForDate(injury.dateOfInjury!)
      return injurySeason === currentSeason
    })

    const count_light_injury_history =
      currentSeasonClassified.filter((c) => c.severity === 'light').length +
      currentSeasonDiseases.length
    const count_medium_injury_history = currentSeasonClassified.filter(
      (c) => c.severity === 'medium'
    ).length
    const count_serious_injury_history = currentSeasonClassified.filter(
      (c) => c.severity === 'serious'
    ).length
    const count_very_serious_injury_history = currentSeasonClassified.filter(
      (c) => c.severity === 'very_serious'
    ).length

    const injury_burden =
      count_light_injury_history * 1 +
      count_medium_injury_history * 2 +
      count_serious_injury_history * 3 +
      count_very_serious_injury_history * 4

    let days_since_last_injury = 365
    if (allInjuriesBeforeDate.length > 0) {
      const lastInjury = allInjuriesBeforeDate[0]
      if (lastInjury.recoveryDate) {
        const daysDiff = currentDate.diff(lastInjury.recoveryDate, 'days').days
        days_since_last_injury = Math.min(365, Math.max(0, Math.round(daysDiff)))
      }
    }

    if (allDiseasesBeforeDate.length > 0) {
      const lastDisease = allDiseasesBeforeDate[0]
      if (lastDisease.endDate) {
        const daysDiff = currentDate.diff(lastDisease.endDate, 'days').days
        days_since_last_injury = Math.min(days_since_last_injury, Math.max(0, Math.round(daysDiff)))
      }
    }

    let frequency_injury_per_season = 0
    if (pastSeasonsWithInjuries.size > 0) {
      const pastSeasonInjuriesCount = pastSeasonInjuries.length + pastSeasonDiseases.length
      frequency_injury_per_season = pastSeasonInjuriesCount / pastSeasonsWithInjuries.size
    }

    const pastSeasonClassified = classifiedInjuries.filter(({ injury }) => {
      const injurySeason = this.getSeasonForDate(injury.dateOfInjury!)
      return injurySeason !== currentSeason
    })

    const injury_severe_past_seasons = pastSeasonClassified.filter(
      (c) => c.severity === 'serious'
    ).length

    const injury_very_severe_past_seasons = pastSeasonClassified.filter(
      (c) => c.severity === 'very_serious'
    ).length

    const hasPlayedBeforeThisSeason = SUNDERLAND_SEASONS.some(
      (season) =>
        (athlete.startDate &&
          athlete.startDate < season.endDate &&
          season.name !== currentSeason &&
          season.endDate < currentDate) ||
        pastSeasonsWithInjuries.size > 0
    )

    return {
      count_light_injury_history,
      count_medium_injury_history,
      count_serious_injury_history,
      count_very_serious_injury_history,
      days_since_last_injury,
      frequency_injury_per_season: hasPlayedBeforeThisSeason ? frequency_injury_per_season : null,
      injury_burden,
      injury_severe_past_seasons: hasPlayedBeforeThisSeason ? injury_severe_past_seasons : null,
      injury_very_severe_past_seasons: hasPlayedBeforeThisSeason
        ? injury_very_severe_past_seasons
        : null,
    }
  }

  private getDefaultValues(): InjuryHistoryVariables {
    return {
      count_light_injury_history: 0,
      count_medium_injury_history: 0,
      count_serious_injury_history: 0,
      count_very_serious_injury_history: 0,
      days_since_last_injury: 365,
      frequency_injury_per_season: 0,
      injury_burden: 0,
      injury_severe_past_seasons: 0,
      injury_very_severe_past_seasons: 0,
    }
  }
}
