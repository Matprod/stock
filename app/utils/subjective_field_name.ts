import string from '@adonisjs/core/helpers/string'
import {
  SUBJECTIVE_VARIABLE_DOMAIN,
  type SubjectiveVariableDomain,
} from '#contracts/subjective_variable'

export const subjectiveFieldNameToModelAttribute = (
  domain: SubjectiveVariableDomain,
  fieldName: string
): string => {
  if (domain === SUBJECTIVE_VARIABLE_DOMAIN.HEALTH_METRIC) {
    return fieldName
  }

  return string.camelCase(fieldName)
}
