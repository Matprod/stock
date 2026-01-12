import type { InsightStatus, NewInsight } from "../types/insight.types";

const getInsightStatus = (insight: NewInsight): InsightStatus => {
  const { value, optimalValue, tresholdTooLow, tresholdLow, tresholdHigh, tresholdTooHigh } = insight;

  if (optimalValue !== null) {
    const percentageDiff = Math.abs(((value - optimalValue) / optimalValue) * 100);

    if (percentageDiff < 10) {
      return "good";
    } else if (percentageDiff <= 50) {
      return value < optimalValue ? "low" : "high";
    } else {
      return value < optimalValue ? "veryLow" : "veryHigh";
    }
  }

  if (tresholdTooHigh !== null && value > tresholdTooHigh) {
    return "veryHigh";
  }
  if (tresholdHigh !== null && value > tresholdHigh) {
    return "high";
  }

  if (tresholdTooLow !== null && value < tresholdTooLow) {
    return "veryLow";
  }
  if (tresholdLow !== null && value < tresholdLow) {
    return "low";
  }

  return "good";
};

export default getInsightStatus;