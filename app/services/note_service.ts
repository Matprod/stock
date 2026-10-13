import { CursorPaginatedNotes, FilterNotesPayload, Note } from '#contracts/note'
import Athlete from '#models_pg/athlete'
import PlayerNote from '#models_pg/player_note'
import Event from '#models_pg/event'
import { DateTime } from 'luxon'
import type { EventCategory } from '#constants/event.constants'
import _ from 'lodash'
import { NOTES_CURSOR_PAGE_SIZE } from '#constants/note.constant'
import { Infer } from '@vinejs/vine/types'
import { addNoteSchema } from '#schemas/note'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'

export class NoteService {
  constructor() {}

  async createNoteForAthlete({
    athleteId,
    noteDate,
    content,
    eventId,
    category,
    trx,
  }: Infer<typeof addNoteSchema> & { eventId?: string; trx?: TransactionClientContract }) {
    const date = DateTime.fromFormat(noteDate, 'yyyy-MM-dd')
    if (!date.isValid) {
      throw new Error('Invalid date format. Use yyyy-MM-dd.')
    }

    const athlete = await Athlete.query({ client: trx ?? undefined })
      .where('id', athleteId)
      .first()
    if (!athlete) {
      throw new Error('Athlete not found')
    }

    let finalCategory = category ?? null

    if (eventId) {
      const event = await Event.query({ client: trx })
        .where('id', eventId)
        .where('clubId', athlete.clubId)
        .preload('eventType')
        .first()

      if (!event) {
        throw new Error('Linked event not found')
      }

      if (event.clubId !== athlete.clubId) {
        throw new Error('Event does not belong to the same club')
      }

      finalCategory = event.eventType.eventCategory
    }

    const note = await PlayerNote.create(
      {
        athleteId,
        noteDate: date,
        content,
        eventId: eventId ?? null,
        category: finalCategory,
      },
      { client: trx ?? undefined }
    )

    return note
  }

  async updateNoteForAthlete({
    noteId,
    content,
    category,
    noteDate,
  }: {
    noteId: string
    content?: string
    category?: EventCategory
    noteDate?: DateTime
  }) {
    const note = await PlayerNote.query().where('id', noteId).first()
    if (!note) {
      throw new Error('Note not found')
    }

    if (noteDate && !noteDate.isValid) {
      throw new Error('Invalid date format. Use yyyy-MM-dd.')
    }

    if (content !== undefined || noteDate || category !== undefined) {
      note.merge({
        content,
        noteDate,
        category,
      })
    }

    await note.save()
    return note
  }

  async getAllNotesForClub(
    clubId: string,
    filters?: FilterNotesPayload,
    seasonStartDate?: DateTime | null,
    seasonEndDate?: DateTime | null
  ): Promise<CursorPaginatedNotes> {
    const athletesQuery = Athlete.query().where('clubId', clubId).select('id')

    if (filters?.athleteId) {
      athletesQuery.where('id', filters.athleteId)
    }

    if (seasonStartDate && seasonEndDate) {
      const seasonStart = seasonStartDate.toJSDate()
      const seasonEnd = seasonEndDate.toJSDate()

      athletesQuery
        .where((query) => {
          query.whereNull('startDate').orWhere('startDate', '<=', seasonEnd)
        })
        .where((query) => {
          query.whereNull('endDate').orWhere('endDate', '>=', seasonStart)
        })
    }

    const notesQuery = PlayerNote.query()
      .whereIn('athleteId', athletesQuery)
      .orderBy('noteDate', 'desc')
      .orderBy('id', 'desc')
      .limit(NOTES_CURSOR_PAGE_SIZE)
      .offset(filters?.cursor ?? 0)
      .preload('event', (eventQuery) => {
        eventQuery.preload('eventType')
      })

    if (seasonStartDate && seasonEndDate) {
      notesQuery.whereBetween('noteDate', [seasonStartDate.toJSDate(), seasonEndDate.toJSDate()])
    }

    if (filters?.category) {
      notesQuery.where('category', filters.category)
    }

    if (filters?.from) {
      const fromDate = DateTime.fromISO(filters.from).startOf('day')
      if (fromDate.isValid) {
        notesQuery.where('noteDate', '>=', fromDate.toJSDate())
      }
    }

    if (filters?.to) {
      const toDate = DateTime.fromISO(filters.to).endOf('day')
      if (toDate.isValid) {
        notesQuery.where('noteDate', '<=', toDate.toJSDate())
      }
    }

    const notes = await notesQuery

    const data: Note[] = notes.map((note) => ({
      id: note.id,
      athleteId: note.athleteId,
      eventId: note.eventId,
      noteDate: note.noteDate.toFormat('yyyy-MM-dd'),
      content: note.content,
      category: note.category,
      eventTitle: note.event?.title || undefined,
      eventTypeName: note.event?.eventType?.name || undefined,
      createdAt: note.createdAt?.toISO() ?? '',
      updatedAt: note.updatedAt?.toISO() ?? '',
    }))

    const currentOffset = filters?.cursor ?? 0
    const nextCursor =
      data.length === NOTES_CURSOR_PAGE_SIZE ? currentOffset + NOTES_CURSOR_PAGE_SIZE : null

    return {
      data,
      meta: { nextCursor },
    }
  }

  async deleteNoteForAthlete({ noteId }: { noteId: string }) {
    const note = await PlayerNote.query().where('id', noteId).first()
    if (!note) {
      throw new Error('Note not found')
    }
    await note.delete()
  }
}
