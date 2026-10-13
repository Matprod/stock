import { ACTIVITY_TO_MILITARY_ACTIVITY } from '#constants/garmin.constants';
export const getMilitaryActivityType = (activityName) => {
    for (const [militaryActivityKey, variations] of Object.entries(ACTIVITY_TO_MILITARY_ACTIVITY)) {
        if (variations.some((variation) => activityName.includes(variation))) {
            return militaryActivityKey;
        }
    }
};
//# sourceMappingURL=military.js.map