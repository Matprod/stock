import Activity from '#models_pg/activity'

let cachedFootballActivityTypeId: string | null = null

export const getFootballActivityTypeId = async (): Promise<string> => {
  if (cachedFootballActivityTypeId) return cachedFootballActivityTypeId

  const activity = await Activity.query().whereILike('name', 'Football').first()
  if (!activity) {
    throw new Error('Football activity type not found')
  }

  cachedFootballActivityTypeId = activity.id
  return activity.id
}
