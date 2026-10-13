import EventType from '#models_pg/event_type'
import Event from '#models_pg/event'
import HealthRating from '#models_pg/health_rating'
import Travel from '#models_pg/travel'
import SportActivity from '#models_pg/sport_activity'
import SportActivityExerciseSet from '#models_pg/exercise_set'
import SportActivityPain from '#models_pg/sport_activity_pain'
import Day from '#models_pg/day'
import AthleteService from '#services/athlete_service'
import { TranslationService } from '#services/translation_service'
import { SportActivityService } from '#services/sport_activity_service'
import { BasketballService } from '#services/api_basketball_service'
import WorkoutSessionInstance from '#models_pg/workout_session_instance'
import Club from '#models_pg/club'
import Athlete from '#models_pg/athlete'
import { TRANSLATABLE_TYPES, TRANSLATION_KEYS } from '#constants/translation.constants'
import type { AppLanguage } from '#utils/localize'
import { EVENT_CATEGORY, type EventCategory } from '#constants/event.constants'
import { createEventSchema, updateEventSchema } from '#schemas/event'
import { Infer } from '@vinejs/vine/types'
import { DateTime } from 'luxon'
import type { Color } from '#constants/color.constants'
import db from '@adonisjs/lucid/services/db'
import { EnrichedEventPayload } from '#contracts/api_basketball'
import type { DataSource } from '#contracts/sport_activity'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { NoteService } from './note_service.js'
import { fetchActivitySeriesDecodedByActivityIds, type SerieEntry } from '../utils/series.js'

type GpsDataSource = Extract<DataSource, 'catapult' | 'statsports' | 'dfl' | 'skillcorner'>

const DEFAULT_MATCH_DURATION_SECONDS = 90 * 60

export type EventTypeWithTranslation = {
  id: string
  name: string
  color: Color
  icon: string
  eventCategory: EventCategory
  activityId: string | null
}

export type EventTypesByCategory = {
  [key in EventCategory]: EventTypeWithTranslation[]
}

export class EventService {
  private translationService: TranslationService
  private athleteService: AthleteService
  private sportActivityService: SportActivityService
  private basketballService: BasketballService
  private noteService: NoteService

  constructor() {
    this.translationService = new TranslationService()
    this.athleteService = new AthleteService()
    this.sportActivityService = new SportActivityService()
    this.basketballService = new BasketballService()
    this.noteService = new NoteService()
  }

  public async getEvent(id: string) {
    return Event.query()
      .where('id', id)
      .preload('sportActivities', (query) => {
        query
          .whereNotNull('dayId')
          .preload('day')
          .preload('sportActivityPains', (query) => {
            query.preload('location', (query) => {
              query.preload('zone')
            })
          })
          .preload('periods')
          .preload('exerciseSets', (setsQuery) => {
            setsQuery.preload('exercise')
          })
          .preload('workoutSessionInstance', (workoutSessionInstanceQuery) => {
            workoutSessionInstanceQuery.preload('exercises', (exercisesQuery) => {
              exercisesQuery.preload('exercise')
            })
          })
      })
      .preload('eventType')
      .preload('athletes', (query) => {
        query.preload('playerPosition').preload('profilePicture')
      })
      .preload('basketballGames', (query) => {
        query.preload('playerStats')
        query.preload('gameStat')
      })
      .first()
  }

  public async getEventTypesByCategory(
    language: AppLanguage,
    clubId: string
  ): Promise<EventTypesByCategory> {
    const club = await Club.query()
      .where('id', clubId)
      .preload('eventTypes', (q) => q.orderBy('event_category').orderBy('name'))
      .first()

    const eventTypes = club?.eventTypes ?? []

    if (eventTypes.length === 0) {
      return {
        [EVENT_CATEGORY.TRAINING]: [],
        [EVENT_CATEGORY.MATCHES]: [],
        [EVENT_CATEGORY.MEDICAL]: [],
        [EVENT_CATEGORY.TRAVEL]: [],
      }
    }

    await this.translationService.applyTranslatedNames(
      eventTypes,
      TRANSLATABLE_TYPES.EVENT_TYPE,
      TRANSLATION_KEYS.EVENT_TYPE_NAME,
      language
    )

    const grouped: EventTypesByCategory = {
      [EVENT_CATEGORY.TRAINING]: [],
      [EVENT_CATEGORY.MATCHES]: [],
      [EVENT_CATEGORY.MEDICAL]: [],
      [EVENT_CATEGORY.TRAVEL]: [],
    }

    eventTypes.forEach((eventType) => {
      const entry = {
        id: eventType.id,
        name: eventType.name,
        color: eventType.color,
        icon: eventType.icon,
        eventCategory: eventType.eventCategory,
        activityId: eventType.activityId,
      }
      if (eventType.eventCategory === EVENT_CATEGORY.MATCHES) {
        grouped[EVENT_CATEGORY.MATCHES].push(entry)
      } else {
        grouped[eventType.eventCategory].push(entry)
      }
    })

    if (grouped[EVENT_CATEGORY.MATCHES].length === 0) {
      const firstMatch = eventTypes.find((et) => et.eventCategory === EVENT_CATEGORY.MATCHES)
      if (firstMatch) {
        grouped[EVENT_CATEGORY.MATCHES].push({
          id: firstMatch.id,
          name: firstMatch.name,
          color: firstMatch.color,
          icon: firstMatch.icon,
          eventCategory: firstMatch.eventCategory,
          activityId: firstMatch.activityId,
        })
      }
    }

    return grouped
  }

  async getEventsByDateRange(clubId: string, startDate: DateTime, endDate: DateTime) {
    return Event.query()
      .where('clubId', clubId)
      .whereBetween('startTime', [startDate.toJSDate(), endDate.toJSDate()])
      .preload('eventType')
      .preload('athletes', (query) => {
        query.preload('profilePicture')
      })
      .preload('sportActivities', (query) => {
        query
          .whereNotNull('dayId')
          .select([
            'id',
            'event_id',
            'workout_session_instance_id',
            'day_id',
            'activity_type_id',
            'rpe',
            'muscular_difficulty',
            'cardio_respiratory',
            'fitness_level',
            'fatigue_level',
            'pleasure_level',
            'active_calories',
          ])
          .preload('day')
          .preload('exerciseSets', (setsQuery) => {
            setsQuery.preload('exercise')
          })
          .preload('workoutSessionInstance', (workoutSessionInstanceQuery) => {
            workoutSessionInstanceQuery.preload('exercises', (exercisesQuery) => {
              exercisesQuery.preload('exercise')
            })
          })
      })
      .orderBy('startTime', 'asc')
  }

  async getEventsByAthleteAndDateRange(
    athleteId: string,
    clubId: string,
    startDate: DateTime,
    endDate: DateTime
  ) {
    return Event.query()
      .where('clubId', clubId)
      .whereBetween('startTime', [startDate.toJSDate(), endDate.toJSDate()])
      .whereHas('athletes', (query) => {
        query.where('athletes.id', athleteId)
      })
      .preload('eventType')
      .preload('sportActivities', (query) => {
        query
          .whereNotNull('dayId')
          .whereHas('day', (dayQuery) => {
            dayQuery.where('athleteId', athleteId)
          })
          .select([
            'id',
            'event_id',
            'workout_session_instance_id',
            'day_id',
            'activity_type_id',
            'rpe',
            'muscular_difficulty',
            'cardio_respiratory',
            'fitness_level',
            'fatigue_level',
            'pleasure_level',
            'active_calories',
          ])
          .preload('day')
          .preload('exerciseSets', (setsQuery) => {
            setsQuery.preload('exercise')
          })
          .preload('workoutSessionInstance', (workoutSessionInstanceQuery) => {
            workoutSessionInstanceQuery.preload('exercises', (exercisesQuery) => {
              exercisesQuery.preload('exercise')
            })
          })
      })
      .orderBy('startTime', 'asc')
  }

  public async getEventForAthlete(eventId: string, athleteId: string) {
    return Event.query()
      .where('id', eventId)
      .whereHas('athletes', (query) => {
        query.where('athletes.id', athleteId)
      })
      .preload('sportActivities', (query) => {
        query
          .whereNotNull('dayId')
          .whereHas('day', (dayQuery) => {
            dayQuery.where('athleteId', athleteId)
          })
          .preload('day')
          .preload('sportActivityPains', (painsQuery) => {
            painsQuery.preload('location', (locationQuery) => {
              locationQuery.preload('zone')
            })
          })
          .preload('periods', (periodQuery) => {
            periodQuery.preload('metricValues', (metricValueQuery) => {
              metricValueQuery.preload('metric')
            })
          })
          .preload('exerciseSets', (setsQuery) => {
            setsQuery.preload('exercise')
          })
          .preload('workoutSessionInstance', (workoutSessionInstanceQuery) => {
            workoutSessionInstanceQuery.preload('exercises', (exercisesQuery) => {
              exercisesQuery.preload('exercise')
            })
          })
      })
      .preload('eventType')
      .preload('basketballGames', (query) => {
        query.preload('playerStats')
        query.preload('gameStat')
      })
      .first()
  }

  async createEvent({
    eventTypeId,
    startTime,
    endTime,
    title,
    location,
    clubId,
    athletes,
    notes,
  }: Infer<typeof createEventSchema> & { clubId: string }) {
    await EventType.findOrFail(eventTypeId)

    if (athletes && athletes.length > 0) {
      await this.validateAthletesBelongToClub(athletes, clubId)
    }
    const trx = await db.transaction()
    try {
      const event = await Event.create(
        {
          eventTypeId,
          startTime: DateTime.fromJSDate(startTime),
          endTime: DateTime.fromJSDate(endTime),
          title,
          location: location || null,
          clubId,
        },
        { client: trx }
      )

      if (athletes) {
        await event.useTransaction(trx).related('athletes').sync(athletes)
      }

      if (athletes && athletes.length > 0) {
        await event.useTransaction(trx).load('eventType')
        const isTrainingOrMatch =
          event.eventType?.eventCategory === EVENT_CATEGORY.TRAINING ||
          event.eventType?.eventCategory === EVENT_CATEGORY.MATCHES

        if (isTrainingOrMatch) {
          await this.handleAthleteAddition(event, athletes, trx)
        }
      }

      if (notes && notes.length > 0) {
        await Promise.all(
          notes.map(async (note) => {
            this.noteService.createNoteForAthlete({
              ...note,
              eventId: event.id,
              trx,
            })
          })
        )
      }

      await event.useTransaction(trx).load('eventType')
      await this.syncEventTravels(event, trx)

      await event.useTransaction(trx).load('athletes', (query) => {
        query.preload('playerPosition').preload('profilePicture')
      })

      await event.useTransaction(trx).load('sportActivities', (query) => {
        query.preload('day')
        query.preload('sportActivityPains', (q) => {
          q.preload('location', (locQ) => locQ.preload('zone'))
        })
      })

      await trx.commit()

      return event
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  async updateEvent({
    id,
    startTime,
    endTime,
    title,
    location,
    clubId,
    athletes,
  }: Infer<typeof updateEventSchema> & { id: string; clubId: string }) {
    if (athletes && athletes.length > 0) {
      await this.validateAthletesBelongToClub(athletes, clubId)
    }

    const event = await Event.query()
      .where('id', id)
      .where('clubId', clubId)
      .preload('athletes')
      .preload('eventType')
      .firstOrFail()

    const oldStartTime = event.startTime
    const oldDateIso = oldStartTime.toISODate()

    const newStartTime = startTime ? DateTime.fromJSDate(startTime) : oldStartTime

    event.merge({
      startTime: newStartTime,
      endTime: endTime ? DateTime.fromJSDate(endTime) : undefined,
      title,
      location: location || null,
    })
    await event.save()

    const newDateIso = newStartTime.toISODate()
    const isDateChange = oldDateIso !== newDateIso
    const isTimeChange = oldStartTime.toFormat('HH:mm') !== newStartTime.toFormat('HH:mm')

    if (isDateChange) {
      await this.migrateEventDataToNewDate(event, newStartTime)
    } else if (isTimeChange) {
      await this.syncActivityTimes(event)
    }

    const currentAthleteIds = event.athletes.map((a) => a.id)
    const newAthleteIds = athletes === undefined ? currentAthleteIds : athletes

    const athleteIdsToDelete = currentAthleteIds.filter((aid) => !newAthleteIds.includes(aid))
    if (athleteIdsToDelete.length > 0) {
      await this.handleAthleteRemoval(event.id, athleteIdsToDelete)
    }

    if (athletes !== undefined) {
      await event.related('athletes').sync(athletes)
    }

    const athleteIdsToAdd = newAthleteIds.filter((aid) => !currentAthleteIds.includes(aid))
    if (athleteIdsToAdd.length > 0) {
      const isTrainingOrMatch =
        event.eventType?.eventCategory === EVENT_CATEGORY.TRAINING ||
        event.eventType?.eventCategory === EVENT_CATEGORY.MATCHES

      if (isTrainingOrMatch) {
        await this.handleAthleteAddition(event, athleteIdsToAdd)
      }
    }

    await event.load('eventType')
    await this.syncEventTravels(event, undefined)

    await event.load('athletes', (query) => {
      query.preload('playerPosition').preload('profilePicture')
    })

    await event.load('sportActivities', (query) => {
      query.preload('day')
      query.preload('sportActivityPains', (q) => {
        q.preload('location', (locQ) => locQ.preload('zone'))
      })
    })

    return event
  }

  private async validateAthletesBelongToClub(athleteIds: string[], clubId: string) {
    if (athleteIds.length === 0) return

    const uniqueAthleteIds = [...new Set(athleteIds)]
    const validAthletes = await Athlete.query()
      .whereIn('id', uniqueAthleteIds)
      .where('clubId', clubId)
      .select('id')

    if (validAthletes.length !== uniqueAthleteIds.length) {
      throw new Error('Security Violation: One or more athletes do not belong to your club.')
    }
  }

  private async handleAthleteRemoval(eventId: string, athleteIdsToDelete: string[]) {
    const activitiesToUnlink = await SportActivity.query()
      .where('eventId', eventId)
      .whereHas('day', (q) => q.whereIn('athleteId', athleteIdsToDelete))

    if (activitiesToUnlink.length > 0) {
      const ids = activitiesToUnlink.map((a) => a.id)
      await SportActivity.query().whereIn('id', ids).update({
        eventId: null,
        workoutSessionInstanceId: null,
        rpe: null,
        pleasureLevel: null,
        fatigueLevel: null,
      })
    }

    await Travel.query()
      .where('eventId', eventId)
      .whereHas('health', (q) => {
        q.whereHas('day', (dq) => dq.whereIn('athleteId', athleteIdsToDelete))
      })
      .delete()
  }

  private async handleAthleteAddition(
    event: Event,
    athleteIdsToAdd: string[],
    trx?: TransactionClientContract
  ) {
    const sibling = await SportActivity.query({ client: trx ?? undefined })
      .where('eventId', event.id)
      .whereNotNull('workoutSessionInstanceId')
      .first()

    const sessionId = sibling?.workoutSessionInstanceId ?? null
    const durationSeconds = Math.round(
      event.endTime.diff(event.startTime, 'milliseconds').milliseconds / 1000
    )
    const timeOfActivity = event.startTime.toFormat('HH:mm:ss')

    if (!event.eventType) await event.load('eventType')

    const targetActivityTypeId = event.eventType?.activityId
    if (!targetActivityTypeId) {
      throw new Error('Cannot create sport activities: event type has no linked activity')
    }

    const dateOfDay = event.startTime.startOf('day')

    for (const athleteId of athleteIdsToAdd) {
      const day = await this.athleteService.getOrCreateDay(athleteId, dateOfDay, trx)

      const ghost = await SportActivity.query({ client: trx ?? undefined })
        .where('dayId', day.id)
        .where('timeOfActivity', timeOfActivity)
        .where('dataSource', 'manual')
        .whereNull('eventId')
        .first()

      let activity: SportActivity

      if (ghost) {
        ghost.merge({
          eventId: event.id,
          workoutSessionInstanceId: sessionId,
          activityTypeId: targetActivityTypeId,
          durationSeconds,
        })
        activity = await ghost.save()
      } else {
        activity = await SportActivity.create(
          {
            eventId: event.id,
            dayId: day.id,
            dataSource: 'manual',
            timeOfActivity: timeOfActivity,
            durationSeconds,
            activityTypeId: targetActivityTypeId,
            workoutSessionInstanceId: sessionId,
            trainingLoad: 0,
          },
          { client: trx ?? undefined }
        )
      }

      if (sessionId && activity) {
        const hasSets = await SportActivityExerciseSet.query()
          .where('sportActivityId', activity.id)
          .first()

        if (!hasSets) {
          const templateSets = await SportActivityExerciseSet.query({ client: trx ?? undefined })
            .where('workoutSessionInstanceId', sessionId)
            .whereNull('sportActivityId')
            .orderBy('order', 'asc')
            .orderBy('setOrder', 'asc')

          if (templateSets.length > 0) {
            await SportActivityExerciseSet.createMany(
              templateSets.map((t) => ({
                sportActivityId: activity.id,
                exerciseId: t.exerciseId,
                reps: t.reps,
                durationSeconds: t.durationSeconds,
                weight: t.weight,
                setOrder: t.setOrder,
                order: t.order,
              }))
            )
          }
          const load = await this.sportActivityService.calculateTrainingLoad(activity.id)
          if (load !== null) {
            activity.trainingLoad = load
            await activity.save()
          }
        }
      }
    }
  }

  private async migrateEventDataToNewDate(event: Event, newDate: DateTime) {
    const dateOfDay = newDate.startOf('day')
    const timeOfActivity = newDate.toFormat('HH:mm:ss')

    const activities = await SportActivity.query().where('eventId', event.id)
    if (activities.length === 0) return

    for (const activity of activities) {
      const oldDay = await Day.find(activity.dayId)
      if (!oldDay) continue

      const newDay = await this.athleteService.getOrCreateDay(oldDay.athleteId, dateOfDay)
      if (oldDay.id === newDay.id) continue

      activity.dayId = newDay.id
      if (activity.dataSource === 'manual') {
        activity.timeOfActivity = timeOfActivity
      }
      await activity.save()
    }

    await this.migrateTravels(event, dateOfDay)
    await this.migrateWorkoutSessions(event)
  }

  private async migrateWorkoutSessions(event: Event) {
    const activities = await SportActivity.query()
      .where('eventId', event.id)
      .whereNotNull('workoutSessionInstanceId')

    const sessionIds = [
      ...new Set(
        activities.map((a) => a.workoutSessionInstanceId).filter((id): id is string => id !== null)
      ),
    ]

    if (sessionIds.length === 0) return

    await WorkoutSessionInstance.query().whereIn('id', sessionIds).update({
      startTime: event.startTime,
      updatedAt: DateTime.now(),
    })
  }

  private async syncActivityTimes(event: Event) {
    const timeOfActivity = event.startTime.toFormat('HH:mm:ss')
    await SportActivity.query().where('eventId', event.id).where('dataSource', 'manual').update({
      timeOfActivity: timeOfActivity,
    })

    await this.migrateWorkoutSessions(event)
  }

  private async migrateTravels(event: Event, newDate: DateTime) {
    const travels = await Travel.query()
      .where('eventId', event.id)
      .preload('health', (q) => q.preload('day'))

    const now = DateTime.now()

    for (const travel of travels) {
      if (!travel.health?.day) continue

      const athleteId = travel.health.day.athleteId
      const newDay = await this.athleteService.getOrCreateDay(athleteId, newDate)

      let newHealth = await HealthRating.query().where('dayId', newDay.id).first()
      if (!newHealth) {
        newHealth = await HealthRating.create({
          dayId: newDay.id,
        })
      }

      travel.healthId = newHealth.id
      travel.updatedAt = now
      await travel.save()
    }
  }

  async syncEventTravels(event: Event, trx?: TransactionClientContract): Promise<void> {
    const eventType = event.eventType
    if (!eventType || eventType.eventCategory !== EVENT_CATEGORY.TRAVEL) return

    const travelType = eventType.travelType ?? 'other'
    const durationMinutes = Math.round(
      event.endTime.diff(event.startTime, 'milliseconds').milliseconds / 60000
    )
    const travels = await Travel.query({ client: trx ?? undefined }).where('eventId', event.id)
    if (travels.length > 0) {
      await Travel.query({ client: trx ?? undefined })
        .whereIn(
          'id',
          travels.map((t) => t.id)
        )
        .update({
          meanOfTransport: travelType,
          durationMinutes,
        })
    }

    if (!event.athletes) await event.load('athletes')

    const travelsWithHealth = await Travel.query({ client: trx ?? undefined })
      .where('eventId', event.id)
      .preload('health', (h) => h.preload('day'))

    const existingAthleteIds = new Set(
      travelsWithHealth.map((t) => t.health?.day?.athleteId).filter((id) => id)
    )
    const athletesToCreate = event.athletes.filter((a) => !existingAthleteIds.has(a.id))

    if (athletesToCreate.length === 0) return

    const dateOfDay = event.startTime.startOf('day')

    for (const athlete of athletesToCreate) {
      const day = await this.athleteService.getOrCreateDay(athlete.id, dateOfDay, trx)
      let health = await HealthRating.query({ client: trx ?? undefined })
        .where('dayId', day.id)
        .first()
      if (!health) {
        health = await HealthRating.create({ dayId: day.id }, { client: trx ?? undefined })
      }

      await Travel.create(
        {
          healthId: health.id,
          eventId: event.id,
          meanOfTransport: travelType,
          durationMinutes,
        },
        { client: trx ?? undefined }
      )
    }
  }

  async deleteEvent(eventId: string, clubId: string) {
    const trx = await db.transaction()
    try {
      const event = await Event.query({ client: trx })
        .where('id', eventId)
        .where('clubId', clubId)
        .first()

      if (!event) throw new Error('Event not found')

      const activities = await SportActivity.query({ client: trx }).where('eventId', eventId)
      const activityIds = activities.map((sa) => sa.id)

      if (activityIds.length > 0) {
        await SportActivityPain.query({ client: trx })
          .whereIn('sportActivityId', activityIds)
          .delete()
        await SportActivityExerciseSet.query({ client: trx })
          .whereIn('sportActivityId', activityIds)
          .delete()
        await SportActivity.query({ client: trx }).whereIn('id', activityIds).delete()
      }

      await Travel.query({ client: trx }).where('eventId', eventId).delete()

      await event.delete()

      const sessionIds = [
        ...new Set(
          activities
            .map((a) => a.workoutSessionInstanceId)
            .filter((id): id is string => id !== null)
        ),
      ]
      if (sessionIds.length > 0) {
        const inUse = await SportActivity.query({ client: trx })
          .whereIn('workoutSessionInstanceId', sessionIds)
          .where('eventId', '!=', eventId)
          .first()

        if (!inUse) {
          await SportActivityExerciseSet.query({ client: trx })
            .whereIn('workoutSessionInstanceId', sessionIds)
            .delete()
          await WorkoutSessionInstance.query({ client: trx }).whereIn('id', sessionIds).delete()
        }
      }

      await trx.commit()
      return { success: true }
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  public async syncSportActivityToCalendar(sportActivity: SportActivity): Promise<void> {
    const sportActivityloaded = await SportActivity.query()
      .where('id', sportActivity.id)
      .preload('day', (q) => q.preload('athlete'))
      .preload('sport')
      .first()

    if (!sportActivityloaded?.day?.athlete) {
      return
    }

    const day = sportActivityloaded.day

    const matchedEvent = await this.findMatchingEventForSportActivity(
      sportActivityloaded,
      day.athlete.clubId,
      sportActivityloaded.activityTypeId
    )

    if (matchedEvent) {
      await sportActivityloaded.merge({ eventId: matchedEvent.id }).save()
      await matchedEvent.load('athletes')
      const existingIds = matchedEvent.athletes.map((a) => a.id)
      if (!existingIds.includes(day.athleteId)) {
        await matchedEvent.related('athletes').sync([...existingIds, day.athleteId])
      }
      return
    }

    const newEvent = await this.createIndividualEventForSportActivity(
      sportActivityloaded,
      day.athleteId,
      day.athlete.clubId
    )
    await sportActivityloaded.merge({ eventId: newEvent.id }).save()
  }

  public async syncCatapultActivityToCalendar(
    sportActivity: SportActivity,
    timeRange?: { startTime: DateTime; endTime: DateTime }
  ): Promise<{ eventId: string; created: boolean } | null> {
    return this.syncGpsActivityToCalendar(sportActivity, 'catapult', timeRange)
  }

  public async syncStatssportsActivityToCalendar(
    sportActivity: SportActivity,
    timeRange?: { startTime: DateTime; endTime: DateTime }
  ): Promise<{ eventId: string; created: boolean } | null> {
    return this.syncGpsActivityToCalendar(sportActivity, 'statsports', timeRange)
  }

  public async syncMatchActivityToCalendar(
    sportActivity: SportActivity
  ): Promise<{ eventId: string; created: boolean } | null> {
    const sportActivityLoaded = await SportActivity.query()
      .where('id', sportActivity.id)
      .preload('day', (q) => q.preload('athlete'))
      .preload('sport')
      .first()

    if (!sportActivityLoaded?.day?.athlete) {
      return null
    }

    const day = sportActivityLoaded.day
    const clubId = day.athlete.clubId

    if (sportActivityLoaded.eventId) {
      const event = await Event.query()
        .where('id', sportActivityLoaded.eventId)
        .preload('eventType')
        .first()

      if (event) {
        await this.promoteEventToMatch(
          event,
          clubId,
          sportActivityLoaded.activityTypeId,
          sportActivityLoaded.activityName
        )
        const merged = await this.mergeSameDayDuplicateMatchEvents(event, clubId)
        if (merged.id !== sportActivityLoaded.eventId) {
          await sportActivityLoaded.merge({ eventId: merged.id }).save()
        }
        await merged.load('athletes')
        const existingIds = merged.athletes.map((athlete) => athlete.id)
        if (!existingIds.includes(day.athleteId)) {
          await merged.related('athletes').sync([...existingIds, day.athleteId])
        }
        return { eventId: merged.id, created: false }
      }
    }

    const dataSource = (sportActivityLoaded.dataSource ?? 'dfl') as GpsDataSource
    return this.syncGpsActivityToCalendar(
      sportActivityLoaded,
      dataSource,
      this.buildMatchTimeRange(sportActivityLoaded)
    )
  }

  private async syncGpsActivityToCalendar(
    sportActivity: SportActivity,
    dataSource: GpsDataSource,
    timeRange?: { startTime: DateTime; endTime: DateTime }
  ): Promise<{ eventId: string; created: boolean } | null> {
    const sportActivityLoaded = await SportActivity.query()
      .where('id', sportActivity.id)
      .preload('day', (q) => q.preload('athlete'))
      .preload('sport')
      .first()

    if (!sportActivityLoaded?.day?.athlete) {
      return null
    }

    const day = sportActivityLoaded.day

    const matchedEvent = await this.findMatchingEventForGpsActivity(
      sportActivityLoaded,
      day.athlete.clubId,
      dataSource
    )

    if (matchedEvent) {
      await sportActivityLoaded.merge({ eventId: matchedEvent.id }).save()
      await matchedEvent.load('athletes')
      const existingIds = matchedEvent.athletes.map((a) => a.id)
      if (!existingIds.includes(day.athleteId)) {
        await matchedEvent.related('athletes').sync([...existingIds, day.athleteId])
      }
      return { eventId: matchedEvent.id, created: false }
    }

    const newEvent = await this.createEventForGpsActivity(
      sportActivityLoaded,
      day.athleteId,
      day.athlete.clubId,
      timeRange
    )
    await sportActivityLoaded.merge({ eventId: newEvent.id }).save()
    return { eventId: newEvent.id, created: true }
  }

  private async findMatchingEventForGpsActivity(
    sportActivity: SportActivity,
    clubId: string,
    dataSource: GpsDataSource
  ): Promise<Event | null> {
    const day = sportActivity.day
    if (!day?.dateOfDay) {
      return null
    }

    const dateOfDay = day.dateOfDay.toFormat('yyyy-MM-dd')

    if (sportActivity.gameActivity === true) {
      return Event.query()
        .where('clubId', clubId)
        .whereHas('sportActivities', (query) => {
          query
            .where('dataSource', dataSource)
            .where('gameActivity', true)
            .whereHas('day', (dayQuery) => {
              dayQuery.where('dateOfDay', dateOfDay)
            })
        })
        .orderBy('startTime', 'asc')
        .first()
    }

    if (!sportActivity.activityName || !sportActivity.timeOfActivity) {
      return null
    }

    return Event.query()
      .where('clubId', clubId)
      .whereHas('sportActivities', (query) => {
        query
          .where('dataSource', dataSource)
          .where('activityName', sportActivity.activityName ?? '')
          .where('timeOfActivity', sportActivity.timeOfActivity ?? '')
          .whereHas('day', (dayQuery) => {
            dayQuery.where('dateOfDay', dateOfDay)
          })
      })
      .orderBy('startTime', 'asc')
      .first()
  }

  public async mergeSameDayDuplicateMatchEvents(event: Event, clubId: string): Promise<Event> {
    const dayStart = event.startTime.startOf('day')
    const dayEnd = event.startTime.endOf('day')
    const candidates = await Event.query()
      .where('clubId', clubId)
      .where('title', event.title)
      .whereBetween('startTime', [dayStart.toJSDate(), dayEnd.toJSDate()])
      .preload('eventType')
      .preload('sportActivities')
      .preload('athletes')

    const matches = candidates.filter(
      (candidate) => candidate.eventType?.eventCategory === EVENT_CATEGORY.MATCHES
    )
    if (matches.length <= 1) return event

    const winner = matches.reduce((best, candidate) =>
      candidate.sportActivities.length > best.sportActivities.length ? candidate : best
    )

    for (const loser of matches) {
      if (loser.id === winner.id) continue
      await SportActivity.query().where('eventId', loser.id).update({ eventId: winner.id })
      await loser.load('athletes')
      await winner.load('athletes')
      const athleteIds = [
        ...new Set([
          ...winner.athletes.map((athlete) => athlete.id),
          ...loser.athletes.map((athlete) => athlete.id),
        ]),
      ]
      await winner.related('athletes').sync(athleteIds)
      await loser.delete()
    }

    return winner
  }

  private async createEventForGpsActivity(
    sportActivity: SportActivity,
    athleteId: string,
    clubId: string,
    timeRange?: { startTime: DateTime; endTime: DateTime }
  ): Promise<Event> {
    const activityIdForType = sportActivity.activityTypeId
    if (activityIdForType === null) {
      throw new Error(
        `Cannot create event for GPS activity without activityTypeId. SportActivity ID: ${sportActivity.id}`
      )
    }

    const club = await Club.query().where('id', clubId).preload('eventTypes').firstOrFail()
    const isGame = sportActivity.gameActivity === true
    const eventCategory = isGame ? EVENT_CATEGORY.MATCHES : EVENT_CATEGORY.TRAINING

    const eventType =
      club.eventTypes.find(
        (event) => event.eventCategory === eventCategory && event.activityId === activityIdForType
      ) ?? club.eventTypes.find((event) => event.eventCategory === eventCategory)

    if (!eventType) {
      throw new Error(
        `No matching EventType for club ${clubId} with category ${eventCategory} and activityId: ${activityIdForType}. Cannot create event for SportActivity ID: ${sportActivity.id}`
      )
    }

    const { activityStart, activityEnd } = this.getGpsActivityTimeRange(sportActivity, timeRange)

    const fallbackTitle = sportActivity.sport?.name
    const title = sportActivity.activityName ?? fallbackTitle ?? 'Activity'

    const trx = await db.transaction()
    try {
      const event = await Event.create(
        {
          eventTypeId: eventType.id,
          startTime: activityStart,
          endTime: activityEnd,
          title,
          location: null,
          clubId,
        },
        { client: trx }
      )

      await event.useTransaction(trx).related('athletes').sync([athleteId])
      await trx.commit()
      return event
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  private async promoteEventToMatch(
    event: Event,
    clubId: string,
    activityTypeId: string | null,
    title?: string | null
  ): Promise<void> {
    await event.load('eventType')
    const alreadyMatch = event.eventType.eventCategory === EVENT_CATEGORY.MATCHES
    if (alreadyMatch && (!title || event.title === title)) {
      return
    }

    if (!alreadyMatch) {
      const club = await Club.query().where('id', clubId).preload('eventTypes').firstOrFail()
      const matchType =
        club.eventTypes.find(
          (eventType) =>
            eventType.eventCategory === EVENT_CATEGORY.MATCHES &&
            eventType.activityId === activityTypeId
        ) ?? club.eventTypes.find((eventType) => eventType.eventCategory === EVENT_CATEGORY.MATCHES)

      if (matchType) {
        event.eventTypeId = matchType.id
      }
    }

    if (title) {
      event.title = title
    }

    if (event.$isDirty) {
      await event.save()
    }
  }

  private buildMatchTimeRange(sportActivity: SportActivity): {
    startTime: DateTime
    endTime: DateTime
  } {
    const activityStart = this.getActivityStartFromSportActivity(sportActivity)
    const durationSeconds = sportActivity.durationSeconds ?? DEFAULT_MATCH_DURATION_SECONDS
    return {
      startTime: activityStart,
      endTime: activityStart.plus({ seconds: durationSeconds }),
    }
  }

  private getGpsActivityTimeRange(
    sportActivity: SportActivity,
    timeRange?: { startTime: DateTime; endTime: DateTime }
  ): { activityStart: DateTime; activityEnd: DateTime } {
    if (timeRange) {
      return { activityStart: timeRange.startTime, activityEnd: timeRange.endTime }
    }

    const activityStart = this.getActivityStartFromSportActivity(sportActivity)
    if (sportActivity.durationSeconds === null) {
      throw new Error(
        `Cannot create event for GPS activity without duration. SportActivity ID: ${sportActivity.id}`
      )
    }
    return {
      activityStart,
      activityEnd: activityStart.plus({ seconds: sportActivity.durationSeconds }),
    }
  }

  private async findMatchingEventForSportActivity(
    sportActivity: SportActivity,
    clubId: string,
    activityTypeId: string | null
  ): Promise<Event | null> {
    const day = sportActivity.day
    if (!day?.dateOfDay || activityTypeId === null) {
      return null
    }

    const dayStart = day.dateOfDay.startOf('day')
    const dayEnd = day.dateOfDay.endOf('day')
    const athleteId = day.athleteId

    const matched = await Event.query()
      .where('clubId', clubId)
      .whereHas('eventType', (q) => q.where('activityId', activityTypeId))
      .whereBetween('startTime', [dayStart.toJSDate(), dayEnd.toJSDate()])
      .whereDoesntHave('sportActivities', (q) => {
        q.whereNot('id', sportActivity.id).whereHas('day', (dayQuery) => {
          dayQuery.where('athleteId', athleteId)
        })
      })
      .orderBy('startTime', 'asc')
      .preload('eventType')
      .first()

    return matched
  }

  private async createIndividualEventForSportActivity(
    sportActivity: SportActivity,
    athleteId: string,
    clubId: string
  ): Promise<Event> {
    const activityIdForType = sportActivity.activityTypeId
    if (activityIdForType === null) {
      throw new Error(
        `Cannot create event for sport activity without activityTypeId. SportActivity ID: ${sportActivity.id}`
      )
    }
    const club = await Club.query().where('id', clubId).preload('eventTypes').firstOrFail()
    const eventType = club.eventTypes.find(
      (event) =>
        event.eventCategory === EVENT_CATEGORY.TRAINING && event.activityId === activityIdForType
    )
    if (!eventType) {
      throw new Error(
        `No matching EventType for club ${clubId} with activityId: ${activityIdForType}. Cannot create event for SportActivity ID: ${sportActivity.id}`
      )
    }
    const activityStart = this.getActivityStartFromSportActivity(sportActivity)
    if (sportActivity.durationSeconds === null) {
      throw new Error(
        `Cannot create event for sport activity without duration. SportActivity ID: ${sportActivity.id}`
      )
    }
    const activityEnd = activityStart.plus({ seconds: sportActivity.durationSeconds })

    const sport = sportActivity.sport
    let activityTitle = sportActivity.activityName ?? sport?.name
    if (!sportActivity.activityName && sport) {
      const sportMap = await this.translationService.getTranslations(
        TRANSLATABLE_TYPES.SPORT,
        TRANSLATION_KEYS.SPORT_NAME,
        [String(sport.id)],
        club.language
      )
      activityTitle = sportMap.get(String(sport.id)) ?? activityTitle
    }

    const trx = await db.transaction()
    try {
      const event = await Event.create(
        {
          eventTypeId: eventType.id,
          startTime: activityStart,
          endTime: activityEnd,
          title: activityTitle ?? 'Activity',
          location: null,
          clubId,
        },
        { client: trx }
      )

      await event.useTransaction(trx).related('athletes').sync([athleteId])
      await trx.commit()
      return event
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  private getActivityStartFromSportActivity(sportActivity: SportActivity): DateTime {
    const day = sportActivity.day
    if (!day?.dateOfDay) {
      throw new Error('Could not determine activity start date.')
    }
    try {
      const [h = 0, m = 0] = (sportActivity.timeOfActivity ?? '00:00:00').split(':').map(Number)
      return day.dateOfDay.set({ hour: h, minute: m })
    } catch (error) {
      throw new Error('Could not determine activity start time.')
    }
  }

  public async getEnrichedEventPayload(eventId: string): Promise<EnrichedEventPayload> {
    await this.basketballService.linkActivitiesToEvent(eventId)

    const event = await this.getEvent(eventId)

    if (!event) {
      throw new Error(`Event with ID ${eventId} not found`)
    }

    const payload = event.toJSON() as EnrichedEventPayload & {
      sportActivities?: Array<{ id: string; series?: SerieEntry[] }>
    }

    if (payload.sportActivities?.length) {
      const seriesByActivityId = await fetchActivitySeriesDecodedByActivityIds(
        payload.sportActivities.map((sportActivity) => sportActivity.id)
      )
      payload.sportActivities = payload.sportActivities.map((sa) => ({
        ...sa,
        series: seriesByActivityId.get(sa.id) ?? [],
      }))
    }

    await this.basketballService.addAthleteIdsToPlayerStats(
      payload.basketballGames ?? [],
      event.clubId
    )

    return payload
  }
}
