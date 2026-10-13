import { TRANSLATABLE_TYPES, TRANSLATION_KEYS } from '#constants/translation.constants'
import type { DisplayVariableUnit } from '#constants/display_variable.constants'
import ActivityDisplayVariable from '#models_pg/activity_display_variable'
import { TranslationService } from '#services/translation_service'
import type { AppLanguage } from '#utils/localize'

export const resolveActivityDisplayVariables = (
  activityDisplayVariables: ActivityDisplayVariable[],
  clubId?: string | null
): ActivityDisplayVariable[] => {
  const byDisplayVariableId = new Map<string, ActivityDisplayVariable>()

  for (const variable of activityDisplayVariables) {
    if (variable.clubId === null) {
      byDisplayVariableId.set(variable.displayVariableId, variable)
    }
  }

  if (clubId) {
    for (const variable of activityDisplayVariables) {
      if (variable.clubId === clubId) {
        byDisplayVariableId.set(variable.displayVariableId, variable)
      }
    }
  }

  return Array.from(byDisplayVariableId.values())
}

export const getActivityVariableUnit = (
  activityDisplayVariables: ActivityDisplayVariable[],
  variableName: string,
  clubId?: string | null
): DisplayVariableUnit | undefined => {
  const resolved = resolveActivityDisplayVariables(activityDisplayVariables, clubId)
  const activityDisplayVariable = resolved.find((dv) => dv.displayVariable.name === variableName)
  return activityDisplayVariable?.unit ?? undefined
}

export const attachDisplayVariableLabels = async (
  activityDisplayVariables: ActivityDisplayVariable[],
  language: AppLanguage,
  translationService = new TranslationService()
): Promise<void> => {
  await translationService.attachTranslatedLabels(
    activityDisplayVariables.map((variable) => variable.displayVariable),
    TRANSLATABLE_TYPES.DISPLAY_VARIABLE,
    TRANSLATION_KEYS.DISPLAY_VARIABLE_NAME,
    language
  )
}

export const presentActivityDisplayVariables = async (
  activityDisplayVariables: ActivityDisplayVariable[],
  language: AppLanguage,
  clubId?: string | null,
  translationService = new TranslationService()
): Promise<ActivityDisplayVariable[]> => {
  const resolved = resolveActivityDisplayVariables(activityDisplayVariables, clubId)
  await attachDisplayVariableLabels(resolved, language, translationService)
  return resolved
}

export const presentActivitiesDisplayVariables = async (
  activities: Array<{ activityDisplayVariables: ActivityDisplayVariable[] }>,
  language: AppLanguage,
  clubId?: string | null,
  translationService = new TranslationService()
): Promise<ActivityDisplayVariable[][]> => {
  const resolvedByActivity = activities.map((activity) =>
    resolveActivityDisplayVariables(activity.activityDisplayVariables, clubId)
  )
  await attachDisplayVariableLabels(resolvedByActivity.flat(), language, translationService)
  return resolvedByActivity
}
