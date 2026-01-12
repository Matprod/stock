import type { APIHealth } from "./player.types";
import type { APISportActivity } from "./sportactivity.types";

export interface APIDay {
  id: number;
  complete: boolean;
  dateOfDay: string;
  athleteId: number;
  health: APIHealth | null;
  sportActivities: APISportActivity[];
  finalScore: number | null;
  healthFinalScore: number | null;
  activityFinalScore: number | null;
  sleepFinalScore: number | null;
  injuryScore: number | null;
  injuryHealthScore: number | null;
  injuryActivityScore: number | null;
  injurySleepScore: number | null;
  dailyAverage: {
    nutriScore: number;
  } | null;
  weight: number | null;
}
