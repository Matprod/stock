import { createModelViewConfig } from '#adomin/create_model_view_config'
import { createRoleVisibilityCheck } from '../utils.js'
import Translation from '#models_pg/translation'

export const TRANSLATION_VIEW = createModelViewConfig(() => Translation, {
  label: 'Traductions',
  icon: 'language',
  visibilityCheck: createRoleVisibilityCheck([]),
  columns: {
    language: {
      type: 'enum',
      label: 'Langue',
      options: [
        { label: 'FR', value: 'fr' },
        { label: 'EN', value: 'en' },
      ],
    },
    translatableType: {
      type: 'enum',
      label: 'Type',
      options: [
        { label: 'Insight', value: 'insight' },
        { label: 'Position', value: 'player_position' },
        { label: 'Notification Message', value: 'notification_message' },
        { label: 'Question Chatbot', value: 'chatbot_question' },
        { label: "Type d'événement", value: 'event_type' },
        { label: 'Type de biomarqueur', value: 'biomarker_type' },
        { label: 'App version', value: 'app_version' },
      ],
    },
    translatableId: {
      type: 'string',
      label: 'Translatable ID',
    },
    key: {
      type: 'enum',
      label: 'Clé',
      options: [
        { label: 'Nom (Insight)', value: 'insight_name' },
        { label: 'Description (Insight)', value: 'insight_description' },
        { label: 'Nom (Position)', value: 'player_position_name' },
        { label: 'Titre (Notification Message)', value: 'notification_message_title' },
        { label: 'Contenu (Notification Message)', value: 'notification_message_content' },
        { label: 'Titre (Question Chatbot)', value: 'chatbot_question_title' },
        { label: 'Question (Question Chatbot)', value: 'chatbot_question_text' },
        { label: "Nom (Type d'événement)", value: 'event_type_name' },
        { label: 'Nom (Type de biomarqueur)', value: 'biomarker_type_name' },
        { label: 'Message (App version)', value: 'app_version_update_message' },
      ],
    },
    value: {
      type: 'string',
      label: 'Traduction',
      size: 500,
    },
    createdAt: {
      type: 'date',
      subType: 'datetime',
      label: 'Création',
      isVisible: async () => false,
    },
    updatedAt: {
      type: 'date',
      subType: 'datetime',
      label: 'Mise à jour',
      isVisible: async () => false,
    },
  },
})
