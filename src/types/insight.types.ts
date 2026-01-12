export type InsightStatus = "veryLow" | "low" | "good" | "high" | "veryHigh";

export interface Insight {
  label: string;
  description?: string;
  status: InsightStatus;
  optimalValue: number;
  value: number | null;
  recommendation?: string;
}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   
export interface NewInsight {
  label: string;
  description?: string;
  value: number;
  optimalValue: number | null;
  maximum: number;
  tresholdHigh: number | null;
  tresholdTooHigh: number | null;
  tresholdLow: number | null;
  tresholdTooLow: number | null;
  type: "health" | "nutrition" | "activity" | "sleep";
  fb: number | null;
  fh: number | null;
  priority?: number | null;
}

interface BaseInsight {
  insights: Array<NewInsight>;
  score?: number;
}

interface ActivityInsight extends BaseInsight {}

interface SleepInsight extends BaseInsight {}

interface NutritionInsight extends BaseInsight {}

interface HealthInsight extends BaseInsight {}

export interface Insights {
  athleteId: number;
  performanceScore: number | null;
  injuryScore: number | null;
  activityInsight: ActivityInsight;
  sleepInsight: SleepInsight;
  nutritionInsight: NutritionInsight;
  healthInsight: HealthInsight;
}
