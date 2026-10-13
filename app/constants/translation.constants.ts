export type TranslationLanguage = 'en' | 'fr'

export const TRANSLATABLE_TYPES = {
  INSIGHT: 'insight',
  PLAYER_POSITION: 'player_position',
  NOTIFICATION_MESSAGE: 'notification_message',
  CHATBOT_QUESTION: 'chatbot_question',
  EVENT_TYPE: 'event_type',
  CLUB_SETTINGS: 'club_settings',
  SUBJECTIVE_VARIABLE: 'subjective_variable',
  ACTIVITY: 'activity',
  SPORT: 'sport',
  ALIMENT: 'aliment',
  INJURY_SECTION: 'injury_section',
  INJURY_TYPE: 'injury_type',
  PAIN_DISCOMFORT_LOCATION: 'pain_discomfort_location',
  BIOMARKER_TYPE: 'biomarker_type',
  DISPLAY_VARIABLE: 'display_variable',
  APP_VERSION: 'app_version',
} as const

export type TranslatableType = (typeof TRANSLATABLE_TYPES)[keyof typeof TRANSLATABLE_TYPES]

export const TRANSLATION_KEYS = {
  // Insight related
  INSIGHT_NAME: 'insight_name',
  INSIGHT_DESCRIPTION: 'insight_description',
  // Player Position related
  PLAYER_POSITION_NAME: 'player_position_name',
  // Notification Message related
  NOTIFICATION_MESSAGE_TITLE: 'notification_message_title',
  NOTIFICATION_MESSAGE_CONTENT: 'notification_message_content',
  // Chatbot Question related
  CHATBOT_QUESTION_TITLE: 'chatbot_question_title',
  CHATBOT_QUESTION_TEXT: 'chatbot_question_text',
  // Calendar events related
  EVENT_TYPE_NAME: 'event_type_name',
  // Activity related
  ACTIVITY_NAME: 'activity_name',
  // Sport related
  SPORT_NAME: 'sport_name',
  // Nutrition related
  ALIMENT_NAME: 'aliment_name',
  // Injury related
  INJURY_SECTION_NAME: 'injury_section_name',
  INJURY_TYPE_NAME: 'injury_type_name',
  PAIN_DISCOMFORT_LOCATION_NAME: 'pain_discomfort_location_name',
  // Biomarker related
  BIOMARKER_TYPE_NAME: 'biomarker_type_name',
  // Display variable related
  DISPLAY_VARIABLE_NAME: 'display_variable_name',
  // Subjective variable related
  SUBJECTIVE_VARIABLE_NAME: 'subjective_variable_name',
  SUBJECTIVE_VARIABLE_DESCRIPTION: 'subjective_variable_description',
  // App version related
  APP_VERSION_UPDATE_MESSAGE: 'app_version_update_message',
} as const

export type TranslationKey = (typeof TRANSLATION_KEYS)[keyof typeof TRANSLATION_KEYS]
