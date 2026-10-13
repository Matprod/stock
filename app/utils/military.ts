import { ACTIVITY_TO_MILITARY_ACTIVITY, MilitaryActivity } from '#constants/garmin.constants'

export const getMilitaryActivityType = (activityName: string): MilitaryActivity | undefined => {
  for (const [militaryActivityKey, variations] of Object.entries(ACTIVITY_TO_MILITARY_ACTIVITY)) {
    if (variations.some((variation) => activityName.includes(variation))) {
      return militaryActivityKey as MilitaryActivity
    }
  }
}
