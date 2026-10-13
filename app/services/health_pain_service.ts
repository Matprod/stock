import HealthPain from '#models_pg/health_pain'

export class HealthPainService {
  public async getAllPains({ athleteId, clubId }: { athleteId?: string; clubId: string }) {
    return HealthPain.query()
      .whereHas('health', (healthQuery) => {
        healthQuery.whereHas('day', (dayQuery) => {
          dayQuery.if(athleteId, (q) => q.where('athleteId', athleteId!))
          dayQuery.whereHas('athlete', (athleteQuery) => {
            athleteQuery.where('clubId', clubId)
          })
        })
      })
      .preload('location', (locationQuery) => {
        locationQuery.preload('zone')
      })
      .preload('health', (healthQuery) => {
        healthQuery.preload('day')
      })
      .orderBy('updatedAt', 'desc')
  }
}
