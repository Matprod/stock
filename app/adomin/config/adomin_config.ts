import { AdominConfig } from '#adomin/adomin_config.types'
import { ATHLETE_VIEW } from './views/athlete_view.js'
import { ATHLETE_PROVIDER_VIEW } from './views/athlete_provider_view.js'
import { CHATBOT_DISCUSSION_VIEW } from './views/chatbot_discussion_view.js'
import { CHATBOT_MESSAGE_VIEW } from './views/chatbot_message_view.js'
import { CHATBOT_QUESTIONS_VIEW } from './views/chatbot_questions_view.js'
import { CLUB_VIEW } from './views/club_view.js'
import { DISCOMFORT_LOCATION_VIEW } from './views/discomfort_location_view.js'
import { INSIGHT_VIEW } from './views/insight_view.js'
import { PLAYER_POSITION_VIEW } from './views/player_position_view.js'
import { PROMPT_VIEW } from './views/prompt_view.js'
import { SPORT_VIEW } from './views/sport_view.js'
import { USER_VIEW } from './views/user_view.js'
import { SEASON_VIEW } from './views/season_view.js'
import { INJURY_VIEW } from './views/injury_view.js'
import { INJURY_TYPE_VIEW } from './views/injury_type_view.js'
import { INJURY_CATEGORY_VIEW } from './views/injury_category_view.js'
import { BIOMARKER_VIEW } from './views/biomarker_view.js'
import { BIOMARKER_TYPE_VIEW } from './views/biomarker_type_view.js'
import { createFolderViewConfig } from '#adomin/create_folder_view_config'
import { USER_ROLE } from '#constants/user.constants'
import { TRANSLATION_VIEW } from './views/translation_view.js'
import { REINFORCEMENT_EXERCICE_VIEW } from './views/exercice_view.js'
import { ACTIVITY_VIEW } from './views/activity_view.js'
import { NOTIFICATION_VIEW } from './views/notification_view.js'
import { MESSAGE_VIEW } from './views/message_view.js'
// import { PERIOD_METRICS_VIEW } from './views/period_metric_view.js'
import { ACTIVITY_DISPLAY_VARIABLE_VIEW } from './views/activity_display_variable_view.js'
import { DISPLAY_VARIABLE_VIEW } from './views/display_variable_view.js'
import { NUTRITION_ALIMENT_VIEW } from './views/nutrition_aliment_view.js'
import { LLM_ALIMENT_VIEW } from './views/nutrition_llm_aliment_view.js'
import { ZONE_VIEW } from './views/zone_view.js'
import { EXERCISE_LOAD_VIEW } from './views/exercise_load_view.js'
import { createRoleVisibilityCheck } from './utils.js'
import { HEALTH_METRICS_VIEW } from './views/health_metric_view.js'
import { SLEEP_METRICS_VIEW } from './views/sleep_metric_view.js'
import { PERIOD_METRICS_VIEW } from './views/period_metric_view.js'
import { CATEGORY_WEIGHT_VIEW } from './views/category_weight_view.js'
import { FEATURE_WEIGHT_VIEW } from './views/feature_weight_view.ts.js'
import { DAY_METRICS_VIEW } from './views/day_metric_view.js'
import { EVENT_TYPE_VIEW } from './views/event_type_view.js'
import { DISEASE_VIEW } from './views/disease_view.js'
import { PERMISSION_VIEW } from './views/permission_view.js'
import { CLUB_SETTINGS_VIEW } from './views/club_settings_view.js'
import { SUBJECTIVE_SCALE_CONFIG_VIEW } from './views/subjective_scale_config_view.js'
import { SUBJECTIVE_SCALE_TRANSLATION_VIEW } from './views/subjective_scale_translation_view.js'
import { CLUB_PROVIDER_VIEW } from './views/club_provider_view.js'
import { APP_VERSION_VIEW } from './views/app_version_view.js'
/**
 * This file will contain your Adomin Config
 * For each view you want to have in you backoffice, you will need to add your views config in the "views" array,
 * with the following syntax:
 *
 * ```ts
 * const YOUR_MODEL_CONFIG = createModelViewConfig(() => YourModel, {})
 * export const ADOMIN_CONFIG: AdominConfig = {
 *  title: 'Your backoffice title',
 *  views: [YOUR_MODEL_CONFIG],
 * }
```
 *
 * if you want to add a stat view use `createStatsViewConfig` instead of `createModelViewConfig`
 */

export const ADOMIN_CONFIG: AdominConfig = {
  title: 'Mauna Admin',
  views: [
    createFolderViewConfig({
      label: 'Users',
      icon: 'users',
      name: 'users',
      visibilityCheck: createRoleVisibilityCheck([USER_ROLE.CLUB_ADMIN]),
      views: [
        createFolderViewConfig({
          label: 'Athletes',
          icon: 'play-football',
          name: 'athletes',
          views: [ATHLETE_VIEW, ATHLETE_PROVIDER_VIEW],
        }),
        createFolderViewConfig({
          label: 'Clubs',
          icon: 'building-stadium',
          name: 'clubs',
          views: [
            USER_VIEW,
            CLUB_VIEW,
            CLUB_PROVIDER_VIEW,
            CLUB_SETTINGS_VIEW,
            SUBJECTIVE_SCALE_CONFIG_VIEW,
            SUBJECTIVE_SCALE_TRANSLATION_VIEW,
            SEASON_VIEW,
            PLAYER_POSITION_VIEW,
          ],
        }),
        PERMISSION_VIEW,
      ],
    }),
    createFolderViewConfig({
      label: 'Activities',
      icon: 'activity',
      name: 'activities',
      visibilityCheck: createRoleVisibilityCheck([USER_ROLE.CLUB_ADMIN]),
      views: [
        SPORT_VIEW,
        ACTIVITY_VIEW,
        createFolderViewConfig({
          label: 'Display Variables',
          icon: 'adjustments-alt',
          name: 'activity-display-variables',
          visibilityCheck: createRoleVisibilityCheck([USER_ROLE.CLUB_ADMIN]),
          views: [DISPLAY_VARIABLE_VIEW, ACTIVITY_DISPLAY_VARIABLE_VIEW],
        }),
        REINFORCEMENT_EXERCICE_VIEW,
        EXERCISE_LOAD_VIEW,
      ],
    }),
    createFolderViewConfig({
      label: 'Metrics',
      icon: 'chart-bar',
      name: 'metrics',
      visibilityCheck: createRoleVisibilityCheck([]),
      views: [PERIOD_METRICS_VIEW, SLEEP_METRICS_VIEW, HEALTH_METRICS_VIEW, DAY_METRICS_VIEW],
    }),
    TRANSLATION_VIEW,
    createFolderViewConfig({
      label: 'Notifications',
      icon: 'bell-ringing-2',
      name: 'notifications',
      visibilityCheck: createRoleVisibilityCheck([USER_ROLE.CLUB_ADMIN]),
      views: [NOTIFICATION_VIEW, MESSAGE_VIEW],
    }),
    createFolderViewConfig({
      label: 'Chatbot',
      icon: 'messages',
      name: 'chatbot',
      visibilityCheck: createRoleVisibilityCheck([]),
      views: [CHATBOT_DISCUSSION_VIEW, CHATBOT_MESSAGE_VIEW, CHATBOT_QUESTIONS_VIEW, PROMPT_VIEW],
    }),
    EVENT_TYPE_VIEW,
    INSIGHT_VIEW,
    DISCOMFORT_LOCATION_VIEW,
    ZONE_VIEW,
    createFolderViewConfig({
      label: 'Poids',
      icon: 'weight',
      name: 'weights',
      visibilityCheck: createRoleVisibilityCheck([]),
      views: [CATEGORY_WEIGHT_VIEW, FEATURE_WEIGHT_VIEW],
    }),
    createFolderViewConfig({
      label: 'Maladies',
      icon: 'heart',
      name: 'diseases',
      views: [DISEASE_VIEW],
    }),
    createFolderViewConfig({
      label: 'Blessures',
      icon: 'bone',
      name: 'injuries',
      views: [INJURY_VIEW, INJURY_TYPE_VIEW, INJURY_CATEGORY_VIEW],
    }),
    APP_VERSION_VIEW,
    createFolderViewConfig({
      label: 'Biomarqueurs',
      icon: 'flask',
      name: 'biomarkers',
      views: [BIOMARKER_VIEW, BIOMARKER_TYPE_VIEW],
    }),
    createFolderViewConfig({
      label: 'Nutrition',
      icon: 'apple',
      name: 'nutrition',
      views: [NUTRITION_ALIMENT_VIEW, LLM_ALIMENT_VIEW],
    }),
  ],
  logo: {
    url: 'https://dashboard.mauna-ai.com/icons/mauna.svg',
    maxHeight: 36,
    textPosition: 'bottom',
  },
}
