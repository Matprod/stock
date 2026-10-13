import { ATHLETE_PROVIDER_TYPES } from '#constants/athlete_provider.constants'
import { CLUB_PROVIDER_TYPES } from '#constants/club_provider.constants'
import { HAMBOURG_CLUB_ID } from '#constants/hambourg.constants'
import AthleteProvider from '#models_pg/athlete_provider'
import ClubProvider from '#models_pg/club_provider'
import SportActivity from '#models_pg/sport_activity'
import { StatssportsService } from '#services/statsports_service'
import { toScalarString, toSessionDate } from '#utils/statsports'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { DateTime } from 'luxon'

export default class StatssportsGap extends BaseCommand {
  static commandName = 'statsports:gap'
  static description = 'Compare recent STATSports API sessions with DB sport_activities'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({ description: 'Club id', default: HAMBOURG_CLUB_ID })
  declare clubId: string

  @flags.number({ description: 'Lookback days', default: 14 })
  declare days: number

  async run() {
    const clubId = this.clubId || HAMBOURG_CLUB_ID
    const to = DateTime.utc()
    const from = to.minus({ days: this.days }).startOf('day')
    const fromDate = from.toISODate()!
    const toDate = to.toISODate()!

    const clubProvider = await ClubProvider.query()
      .where('clubId', clubId)
      .where('provider', CLUB_PROVIDER_TYPES.STATSPORTS)
      .first()

    const statsportsAthleteProviders = await AthleteProvider.query()
      .where('provider', ATHLETE_PROVIDER_TYPES.STATSPORTS)
      .whereNotNull('providerAthleteId')
      .preload('athlete', (query) => query.where('clubId', clubId))

    const mappedPlayerIds = new Set(
      statsportsAthleteProviders
        .filter((row) => row.athlete && row.providerAthleteId)
        .map((row) => String(row.providerAthleteId))
    )

    const latest = await SportActivity.query()
      .where('dataSource', 'statsports')
      .whereHas('day', (query) => {
        query.whereHas('athlete', (athleteQuery) => athleteQuery.where('clubId', clubId))
      })
      .preload('day')
      .orderBy('createdAt', 'desc')
      .first()

    const recent = await SportActivity.query()
      .where('dataSource', 'statsports')
      .whereHas('day', (query) => {
        query
          .where('dateOfDay', '>=', fromDate)
          .where('dateOfDay', '<=', toDate)
          .whereHas('athlete', (athleteQuery) => athleteQuery.where('clubId', clubId))
      })
      .preload('day')
      .preload('periods')

    const dbByDate = new Map<string, { activities: number; periods: number }>()
    for (const activity of recent) {
      const date = activity.day.dateOfDay.toISODate()
      if (!date) continue
      const current = dbByDate.get(date) ?? { activities: 0, periods: 0 }
      current.activities++
      current.periods += activity.periods?.length ?? 0
      dbByDate.set(date, current)
    }

    console.log('')
    console.log(`Club ${clubId}`)
    console.log(`Window ${fromDate} → ${toDate}`)
    console.log(
      `Club provider: ${clubProvider ? `yes lastSyncedAt=${clubProvider.lastSyncedAt?.toISO() ?? 'never'}` : 'MISSING'}`
    )
    console.log(`STATSports athlete_providers: ${mappedPlayerIds.size}`)
    console.log(
      `Latest DB statsports activity: ${
        latest?.day?.dateOfDay.toISODate() ?? 'none'
      } createdAt=${latest?.createdAt?.toISO() ?? 'n/a'}`
    )
    console.log(
      `DB in window: ${recent.length} activities / ${[...dbByDate.values()].reduce((sum, row) => sum + row.periods, 0)} periods across ${dbByDate.size} day(s)`
    )

    if (!clubProvider?.accessToken) {
      this.logger.error('No STATSports club provider with accessToken — cannot compare API')
      this.exitCode = 1
      return
    }

    const service = StatssportsService.fromClubProvider(clubProvider)
    const api = await service.fetchMappedRows({
      sessionStart: from.toUTC().toISO()!,
      sessionEnd: to.toUTC().toISO()!,
      chunkDays: 3,
    })

    type ApiDay = {
      rows: number
      withPlayerId: number
      mapped: number
      sessions: Set<string>
    }
    const apiByDate = new Map<string, ApiDay>()
    let withPlayerId = 0
    let mapped = 0

    for (const row of api.rows) {
      const date = toSessionDate(row.session_date)
      if (!date) continue
      const current = apiByDate.get(date) ?? {
        rows: 0,
        withPlayerId: 0,
        mapped: 0,
        sessions: new Set<string>(),
      }
      current.rows++
      const sessionKey = `${toScalarString(row.session_id) ?? ''}|${toScalarString(row.session_type) ?? ''}|${toScalarString(row.session_start_time) ?? ''}`
      current.sessions.add(sessionKey)
      const playerId = toScalarString(row.player_customPlayerId)
      if (playerId) {
        current.withPlayerId++
        withPlayerId++
        if (mappedPlayerIds.has(playerId)) {
          current.mapped++
          mapped++
        }
      }
      apiByDate.set(date, current)
    }

    console.log(
      `API in window: ${api.rows.length} drill rows / ${api.bundles} sessions / ${apiByDate.size} day(s)`
    )
    console.log(
      `API player_customPlayerId filled=${withPlayerId}/${api.rows.length}  mapped to DB athlete=${mapped}`
    )
    console.log('')
    console.log('date         api_rows  api_sessions  api_mappable  db_activities  db_periods  gap')

    const dates = [...new Set([...apiByDate.keys(), ...dbByDate.keys()])].sort()
    for (const date of dates) {
      const apiDay = apiByDate.get(date)
      const dbDay = dbByDate.get(date)
      const apiRows = apiDay?.rows ?? 0
      const apiSessions = apiDay?.sessions.size ?? 0
      const apiMappable = apiDay?.mapped ?? 0
      const dbActivities = dbDay?.activities ?? 0
      const dbPeriods = dbDay?.periods ?? 0
      const gap =
        apiMappable > 0 && dbActivities === 0
          ? 'MISSING_IN_DB'
          : apiRows > 0 && dbActivities === 0
            ? 'API_ONLY_UNMAPPED'
            : dbActivities > 0 && apiRows === 0
              ? 'DB_ONLY'
              : 'ok'
      console.log(
        `${date}  ${String(apiRows).padStart(8)}  ${String(apiSessions).padStart(12)}  ${String(apiMappable).padStart(12)}  ${String(dbActivities).padStart(13)}  ${String(dbPeriods).padStart(10)}  ${gap}`
      )
    }
    console.log('')
  }
}
