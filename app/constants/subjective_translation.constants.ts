export const SUBJECTIVE_LEVEL_TRANSLATION_MAX = 100

export const SUBJECTIVE_VARIABLE_NAME_KEY = 'subjective_variable_name'
export const SUBJECTIVE_VARIABLE_DESCRIPTION_KEY = 'subjective_variable_description'

export const SUBJECTIVE_VARIABLE_LEVEL_KEY = (level: number): string => {
  return `subjective_variable_level:${level}`
}

export const SUBJECTIVE_VARIABLE_TRANSLATION_KEY_OPTIONS: Array<{ label: string; value: string }> =
  [{ label: 'Nom variable subjective', value: SUBJECTIVE_VARIABLE_NAME_KEY }].concat([
    { label: 'Description variable subjective', value: SUBJECTIVE_VARIABLE_DESCRIPTION_KEY },
  ])

export const SUBJECTIVE_VARIABLE_LEVEL_TRANSLATION_KEY_OPTIONS: Array<{
  label: string
  value: string
}> = Array.from({ length: SUBJECTIVE_LEVEL_TRANSLATION_MAX }, (_, i) => {
  const level = i + 1
  return {
    label: `Description niveau subjective ${level}`,
    value: SUBJECTIVE_VARIABLE_LEVEL_KEY(level),
  }
})
