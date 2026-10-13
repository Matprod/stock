import PriorityCategoryWeight from '#models_pg/priority_category_weight';
import PriorityFeatureWeight from '#models_pg/priority_feature_weight';
export class PriorityService {
    isOptimal(insight) {
        const { value, optimalValue, tresholdTooLow, tresholdLow, tresholdHigh, tresholdTooHigh } = insight;
        if (optimalValue !== null) {
            return optimalValue === value;
        }
        if (tresholdTooHigh !== null && value > tresholdTooHigh) {
            return false;
        }
        if (tresholdHigh !== null && value > tresholdHigh) {
            return false;
        }
        if (tresholdTooLow !== null && value < tresholdTooLow) {
            return false;
        }
        if (tresholdLow !== null && value < tresholdLow) {
            return false;
        }
        return true;
    }
    async getCategoryWeights(clubId, type) {
        const weights = await PriorityCategoryWeight.query().where('clubId', clubId).where('type', type);
        const result = {
            activity: 0.4,
            sleep: 0.2,
            nutrition: 0.2,
            health: 0.2,
        };
        weights.forEach((weight) => {
            result[weight.categoryType] = weight.weight;
        });
        return result;
    }
    async calculatePriorityRanking(params) {
        const { insights, featureImportances, shapValueMap, clubId, type } = params;
        const insightIdMap = new Map();
        featureImportances.forEach((feature, index) => {
            insightIdMap.set(index, feature.insightId);
        });
        const categoryWeights = await this.getCategoryWeights(clubId, type);
        const insightIdsNeedingWeights = new Set();
        for (let index = 0; index < insights.length; index++) {
            const insight = insights[index];
            if (!this.isOptimal(insight)) {
                const insightId = insightIdMap.get(index);
                const shapValue = insightId ? (shapValueMap.get(insightId) ?? null) : null;
                if (!shapValue && insightId) {
                    insightIdsNeedingWeights.add(insightId);
                }
            }
        }
        const featureWeights = await PriorityFeatureWeight.query()
            .where('clubId', clubId)
            .where('type', type)
            .whereIn('insightId', Array.from(insightIdsNeedingWeights));
        const featureWeightMap = new Map();
        featureWeights.forEach((weight) => {
            featureWeightMap.set(weight.insightId, weight.weight);
        });
        const insightsWithScores = [];
        for (let index = 0; index < insights.length; index++) {
            const insight = insights[index];
            if (!this.isOptimal(insight)) {
                const insightId = insightIdMap.get(index);
                const shapValue = insightId ? (shapValueMap.get(insightId) ?? null) : null;
                let priorityScore;
                if (shapValue !== null && shapValue !== 0) {
                    priorityScore = shapValue;
                }
                else if (insightId) {
                    if (!categoryWeights) {
                        return insights.map((insight) => ({ ...insight, priority: null }));
                    }
                    const categoryWeight = categoryWeights[insight.type] || 0;
                    const featureWeight = featureWeightMap.get(insightId);
                    if (!featureWeight) {
                        continue;
                    }
                    priorityScore = featureWeight * categoryWeight;
                }
                else {
                    continue;
                }
                insightsWithScores.push({
                    insight,
                    originalIndex: index,
                    priorityScore,
                });
            }
        }
        if (type === 'performance') {
            insightsWithScores.sort((a, b) => a.priorityScore - b.priorityScore);
        }
        else {
            insightsWithScores.sort((a, b) => b.priorityScore - a.priorityScore);
        }
        const priorityMap = new Map();
        insightsWithScores.forEach((item, index) => {
            priorityMap.set(item.originalIndex, index + 1);
        });
        return insights.map((insight, index) => {
            const priority = priorityMap.get(index) ?? null;
            return {
                ...insight,
                priority,
            };
        });
    }
}
//# sourceMappingURL=priority_service.js.map