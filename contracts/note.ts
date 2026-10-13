import type { EventCategory } from '#constants/event.constants'

export interface FilterNotesPayload {
  cursor?: number
  athleteId?: string
  category?: EventCategory
  from?: string
  to?: string
}

export interface Note {
  id: string
  athleteId: string
  eventId?: string | null
  noteDate: string
  content: string
  category: EventCategory | null
  eventTitle?: string
  eventTypeName?: string
  createdAt: string
  updatedAt: string
}

export interface CursorPaginatedNotes {
  data: Note[]
  meta: {
    nextCursor: number | null
  }
}
