export interface FilterWorkoutsLibraryPayload {
  searchQuery?: string
  sportId?: string
  exerciseId?: string
}

export interface FilterWorkoutsPayload {
  cursor?: number
  searchQuery?: string
  sportId?: string
  exerciseId?: string
  playerId?: string
  from?: string
  to?: string
}
