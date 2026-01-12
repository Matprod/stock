import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// French
import frLogin from "./locales/fr/login.json";
import frDashboard from "./locales/fr/dashboard.json";
import frSidebar from "./locales/fr/sidebar.json";
import frCommon from "./locales/fr/common.json";
import frTeamOverview from "./locales/fr/team_overview.json";
import frPlayer from "./locales/fr/player.json";
import frSummary from "./locales/fr/summary.json";
import frNotes from "./locales/fr/notes.json";
import frChatbot from "./locales/fr/chatbot.json";
import frInjury from "./locales/fr/injury.json";
import frNutrition from "./locales/fr/nutrition.json";
import frWorkout from "./locales/fr/workout.json";

// English
import enLogin from "./locales/en/login.json";
import enDashboard from "./locales/en/dashboard.json";
import enSidebar from "./locales/en/sidebar.json";
import enCommon from "./locales/en/common.json";
import enTeamOverview from "./locales/en/team_overview.json";
import enPlayer from "./locales/en/player.json";
import enSummary from "./locales/en/summary.json";
import enNotes from "./locales/en/notes.json";
import enChatbot from "./locales/en/chatbot.json";
import enInjury from "./locales/en/injury.json";
import enNutrition from "./locales/en/nutrition.json";
import enWorkout from "./locales/en/workout.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: {
        login: frLogin,
        dashboard: frDashboard,
        sidebar: frSidebar,
        common: frCommon,
        team_overview: frTeamOverview,
        player: frPlayer,
        summary: frSummary,
        notes: frNotes,
        chatbot: frChatbot,
        injury: frInjury,
        nutrition: frNutrition,
        workout: frWorkout,
      },
      en: {
        login: enLogin,
        dashboard: enDashboard,
        sidebar: enSidebar,
        common: enCommon,
        team_overview: enTeamOverview,
        player: enPlayer,
        summary: enSummary,
        notes: enNotes,
        chatbot: enChatbot,
        injury: enInjury,
        nutrition: enNutrition,
        workout: enWorkout,
      },
    },
    ns: [
      "login",
      "dashboard",
      "sidebar",
      "common",
      "team_overview",
      "player",
      "summary",
      "notes",
      "chatbot",
      "nutrition",
      "injury",
      "workout",
    ],
    defaultNS: "common",
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
    pluralSeparator: "_",
  });

export default i18n;
