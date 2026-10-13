import { TRANSLATABLE_TYPES, TRANSLATION_KEYS } from '#constants/translation.constants';
import { TranslationService } from '#services/translation_service';
export const resolveActivityDisplayVariables = (activityDisplayVariables, clubId) => {
    const byDisplayVariableId = new Map();
    for (const variable of activityDisplayVariables) {
        if (variable.clubId === null) {
            byDisplayVariableId.set(variable.displayVariableId, variable);
        }
    }
    if (clubId) {
        for (const variable of activityDisplayVariables) {
            if (variable.clubId === clubId) {
                byDisplayVariableId.set(variable.displayVariableId, variable);
            }
        }
    }
    return Array.from(byDisplayVariableId.values());
};
export const getActivityVariableUnit = (activityDisplayVariables, variableName, clubId) => {
    const resolved = resolveActivityDisplayVariables(activityDisplayVariables, clubId);
    const activityDisplayVariable = resolved.find((dv) => dv.displayVariable.name === variableName);
    return activityDisplayVariable?.unit ?? undefined;
};
export const attachDisplayVariableLabels = async (activityDisplayVariables, language, translationService = new TranslationService()) => {
    await translationService.attachTranslatedLabels(activityDisplayVariables.map((variable) => variable.displayVariable), TRANSLATABLE_TYPES.DISPLAY_VARIABLE, TRANSLATION_KEYS.DISPLAY_VARIABLE_NAME, language);
};
export const presentActivityDisplayVariables = async (activityDisplayVariables, language, clubId, translationService = new TranslationService()) => {
    const resolved = resolveActivityDisplayVariables(activityDisplayVariables, clubId);
    await attachDisplayVariableLabels(resolved, language, translationService);
    return resolved;
};
export const presentActivitiesDisplayVariables = async (activities, language, clubId, translationService = new TranslationService()) => {
    const resolvedByActivity = activities.map((activity) => resolveActivityDisplayVariables(activity.activityDisplayVariables, clubId));
    await attachDisplayVariableLabels(resolvedByActivity.flat(), language, translationService);
    return resolvedByActivity;
};
//# sourceMappingURL=get_activity_variable.js.map