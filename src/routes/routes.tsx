import type { RouteObject } from "react-router-dom";
import { SideBarLayout } from "../layouts/side_bar";
import Dashboard from "../pages/dashboard/dashboard";
import LoginPage from "../pages/login/login";
import PlayerPage from "../pages/player/player";
import SummaryPage from "../pages/player/summary/summary";
import NutritionDetailPage from "../pages/player/nutrition-detail/nutrition-detail";
import TeamOverview from "../pages/team_overview";
import NotesPage from "../pages/notes/notes";
import PrivacyPolicy from "../pages/privacy_policy";
import WorkoutSessionsPage from "../pages/workout-sessions/workout_sessions";
import { PlayerInjuriesPage } from "../pages/player_injuries/player_injuries";

export const routes: RouteObject = {
  element: <SideBarLayout />,
  children: [
    {
      index: true,
      element: <TeamOverview />,
    },
    {
      path: "/privacy-policy",
      element: <PrivacyPolicy />,
    },
    {
      path: "/dashboard",
      element: <Dashboard />,
    },
    {
      path: "/notes",
      element: <NotesPage />,
    },
    {
      path: "/workout-sessions",
      element: <WorkoutSessionsPage />,
    },
    {
      path: "/player-injuries",
      element: <PlayerInjuriesPage />,
    },
    {
      path: "/player/:playerId",
      children: [
        {
          index: true,
          element: <PlayerPage />,
        },
        {
          path: "summary",
          element: <SummaryPage />,
        },
        {
          path: "nutrition-detail",
          element: <NutritionDetailPage />,
        },
      ],
    },
    {
      path: "/login",
      element: <LoginPage />,
    },
  ],
};

