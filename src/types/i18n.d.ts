import "i18next";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: {
      login: typeof import("../i18n/locales/fr/login.json");
      dashboard: typeof import("../i18n/locales/fr/dashboard.json");
      sidebar: typeof import("../i18n/locales/fr/sidebar.json");
      common: typeof import("../i18n/locales/fr/common.json");
      team_overview: typeof import("../i18n/locales/fr/team_overview.json");
      player: typeof import("../i18n/locales/fr/player.json");
      summary: typeof import("../i18n/locales/fr/summary.json");
      notes: typeof import("../i18n/locales/fr/notes.json");
      chatbot: typeof import("../i18n/locales/fr/chatbot.json");
      injury: typeof import("../i18n/locales/fr/injury.json");
      nutrition: typeof import("../i18n/locales/fr/nutrition.json");
      workout: typeof import("../i18n/locales/fr/workout.json");
    };
  }
}
