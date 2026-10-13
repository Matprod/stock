import { METRIC_AGGREGATION_METHOD, } from '#constants/metrics.constants';
import { TRANSLATABLE_TYPES, TRANSLATION_KEYS } from '#constants/translation.constants';
import { APP_LANGUAGES } from '#utils/localize';
import Athlete from '#models_pg/athlete';
import Prompt from '#models_pg/prompt';
import ChatbotReport from '#models_pg/chatbot_report';
import { TranslationService } from '#services/translation_service';
import { getName } from '#utils/localize';
import { DateTime } from 'luxon';
import { postProcessMetric } from '../utils/metric_utils.js';
import { CHATBOT_FILTERED_PERIOD_METRICS, getChatbotMetricWhitelist, isChatbotAllowedPeriodMetric, INSIGHT_FACTOR_CATAPULT_MAPPING, usesStatsportsMetricWhitelist, } from '#constants/chatbot.constants';
export default class PromptService {
    translationService;
    constructor() {
        this.translationService = new TranslationService();
    }
    pickPrimarySleep(day) {
        const sleeps = day.sleeps ?? [];
        if (sleeps.length === 0)
            return null;
        const withWake = sleeps.filter((s) => s.wakeUpDate);
        const candidates = withWake.length > 0 ? withWake : sleeps;
        return [...candidates].sort((a, b) => {
            const aTs = (a.wakeUpDate ?? a.createdAt)?.toMillis?.() ?? 0;
            const bTs = (b.wakeUpDate ?? b.createdAt)?.toMillis?.() ?? 0;
            return bTs - aTs;
        })[0];
    }
    formatPerformanceSubjectivesBlock(day) {
        const energy = day.health?.energyRating;
        const soreness = day.health?.bodySorenessRating;
        const sleepQuality = this.pickPrimarySleep(day)?.qualityRating;
        const fmt = (v) => v === null || v === undefined ? 'indéfini' : String(v);
        const extraMetrics = (day.health?.metricValues ?? [])
            .filter((mv) => mv.metric)
            .map((mv) => `- ${mv.metric.name}${mv.metric.unit ? ` (${mv.metric.unit})` : ''} : ${mv.value}`);
        return [
            'Données subjectives :',
            `- subjective energy : ${fmt(energy)}`,
            `- sleep quality : ${fmt(sleepQuality)}`,
            `- body soreness : ${fmt(soreness)}`,
            ...extraMetrics,
        ].join('\n');
    }
    replaceVariables(template, variables) {
        let result = template;
        for (const [key, value] of Object.entries(variables)) {
            result = result.replaceAll(`{${key}}`, value != null ? String(value) : '');
        }
        return result;
    }
    getFeaturesToImprove(day, category) {
        const categoryFeatures = (day.featureImportances ?? []).filter((f) => f.category === category);
        const toImprove = categoryFeatures.filter((f) => {
            if (f.optimal !== null)
                return f.value !== f.optimal;
            const { insight } = f;
            if (insight.tresholdLow != null && f.value < insight.tresholdLow)
                return true;
            if (insight.tresholdTooLow != null && f.value < insight.tresholdTooLow)
                return true;
            if (insight.tresholdHigh != null && f.value > insight.tresholdHigh)
                return true;
            if (insight.tresholdTooHigh != null && f.value > insight.tresholdTooHigh)
                return true;
            return false;
        });
        if (category === 'performance') {
            toImprove.sort((a, b) => (a.shapValue ?? 0) - (b.shapValue ?? 0));
        }
        else {
            toImprove.sort((a, b) => (b.shapValue ?? 0) - (a.shapValue ?? 0));
        }
        return toImprove;
    }
    getOptimalFeatures(day, category) {
        const categoryFeatures = (day.featureImportances ?? []).filter((f) => f.category === category);
        return categoryFeatures.filter((f) => {
            if (f.optimal !== null)
                return f.value === f.optimal;
            const { insight } = f;
            if (insight.tresholdLow != null && f.value < insight.tresholdLow)
                return false;
            if (insight.tresholdTooLow != null && f.value < insight.tresholdTooLow)
                return false;
            if (insight.tresholdHigh != null && f.value > insight.tresholdHigh)
                return false;
            if (insight.tresholdTooHigh != null && f.value > insight.tresholdTooHigh)
                return false;
            return true;
        });
    }
    getDayMetricsMap(day) {
        const map = new Map();
        for (const mv of day.metricValues ?? []) {
            const metric = mv.metric;
            if (metric?.name) {
                map.set(metric.name, mv.value ?? 'N/A');
            }
        }
        return map;
    }
    getFactorDecomposition(variableName) {
        if (!variableName)
            return null;
        const keysByLength = Object.keys(INSIGHT_FACTOR_CATAPULT_MAPPING).sort((a, b) => b.length - a.length);
        for (const key of keysByLength) {
            if (variableName.includes(key)) {
                return { key, variables: INSIGHT_FACTOR_CATAPULT_MAPPING[key] };
            }
        }
        return null;
    }
    getConseil(f) {
        if (f.optimal !== null) {
            const diff = f.value - f.optimal;
            if (diff < 0)
                return 'Augmenter';
            if (diff > 0)
                return 'Diminuer';
            return 'Optimal';
        }
        const { insight } = f;
        if ((insight.tresholdLow != null && f.value < insight.tresholdLow) ||
            (insight.tresholdTooLow != null && f.value < insight.tresholdTooLow))
            return 'Augmenter';
        if ((insight.tresholdHigh != null && f.value > insight.tresholdHigh) ||
            (insight.tresholdTooHigh != null && f.value > insight.tresholdTooHigh))
            return 'Diminuer';
        return 'Optimal';
    }
    formatPointsToImproveLine(f, priority, dayMetricsMap, insightDisplayNameById) {
        const value = Math.round(f.value * 100) / 100;
        const optimal = f.optimal !== null ? Math.round(f.optimal * 100) / 100 : '-';
        const conseil = this.getConseil(f);
        const name = (f.insight && insightDisplayNameById.get(f.insight.id)) ??
            f.insight?.name ??
            f.insight?.variableName ??
            'Variable';
        const shapPart = ` | SHAP : ${f.shapValue ?? 0}`;
        let block = `- ${name} : Valeur : ${value} | Optimal : ${optimal} | Conseil : ${conseil}${shapPart} | Priorité : ${priority}`;
        const decomposition = this.getFactorDecomposition(f.insight?.variableName);
        if (decomposition) {
            const tlFactor = dayMetricsMap.get(decomposition.key);
            if (tlFactor !== undefined) {
                block += `\n**Levier principal (${decomposition.key}) :** ${tlFactor}`;
            }
            const rawVars = decomposition.variables
                .map((v, i) => `${v} *(contribution ${i + 1})*`)
                .join('\n- ');
            block += `\n**Décomposition (variables brutes contributrices) — ${decomposition.key} :**\n- ${rawVars}`;
        }
        return block;
    }
    buildPointsToImproveBlock(day, category, insightDisplayNameById) {
        const features = this.getFeaturesToImprove(day, category);
        if (features.length === 0)
            return '';
        const dayMetricsMap = this.getDayMetricsMap(day);
        const featuresWithIndex = features.map((f, index) => ({ feature: f, globalIndex: index }));
        const byDomain = {
            activity: featuresWithIndex.filter(({ feature }) => feature.type === 'activity'),
            sleep: featuresWithIndex.filter(({ feature }) => feature.type === 'sleep'),
            health: featuresWithIndex.filter(({ feature }) => feature.type === 'health'),
        };
        const domainSections = [
            { key: 'activity', title: '🔍 Activité — Points à améliorer' },
            { key: 'sleep', title: '🛌 Sommeil — Points à améliorer' },
            { key: 'health', title: '🩺 Santé — Points à améliorer ' },
        ];
        const sectionBlocks = domainSections
            .map(({ key, title }) => {
            const items = byDomain[key];
            if (items.length === 0)
                return '';
            const lines = items.map(({ feature, globalIndex }) => this.formatPointsToImproveLine(feature, globalIndex + 1, dayMetricsMap, insightDisplayNameById));
            return `${title}\n\n${lines.join('\n\n')}`;
        })
            .filter(Boolean);
        return sectionBlocks.join('\n\n');
    }
    formatOptimalPointLine(f, insightDisplayNameById) {
        const optimal = f.optimal !== null ? Math.round(f.optimal * 100) / 100 : '-';
        const name = (f.insight && insightDisplayNameById.get(f.insight.id)) ??
            f.insight?.name ??
            f.insight?.variableName ??
            'Variable';
        let block = `- ${name} : Optimal : ${optimal}`;
        const decomposition = this.getFactorDecomposition(f.insight?.variableName);
        if (decomposition) {
            const rawVars = decomposition.variables
                .map((v, i) => `${v} *(contribution ${i + 1})*`)
                .join('\n- ');
            block += `\n\n**Variables brutes cohérentes avec cet optimal — ${decomposition.key} :**\n- ${rawVars}`;
        }
        return block;
    }
    buildOptimalPointsBlock(day, category, insightDisplayNameById) {
        const features = this.getOptimalFeatures(day, category);
        if (features.length === 0)
            return '';
        const byDomain = {
            activity: features.filter((f) => f.type === 'activity'),
            sleep: features.filter((f) => f.type === 'sleep'),
            health: features.filter((f) => f.type === 'health'),
        };
        const domainSections = [
            { key: 'activity', title: '🔍 Activité — Points optimaux' },
            { key: 'sleep', title: '🛌 Sommeil — Points optimaux' },
            { key: 'health', title: '🩺 Santé — Points optimaux' },
        ];
        const sectionBlocks = domainSections
            .map(({ key, title }) => {
            const domainFeatures = byDomain[key];
            if (domainFeatures.length === 0)
                return '';
            const lines = domainFeatures.map((f) => this.formatOptimalPointLine(f, insightDisplayNameById));
            return `${title}\n\n${lines.join('\n\n')}`;
        })
            .filter(Boolean);
        return sectionBlocks.join('\n\n');
    }
    aggregateMetricValues(values, method = METRIC_AGGREGATION_METHOD.SUM) {
        if (!values.length)
            return null;
        switch (method) {
            case METRIC_AGGREGATION_METHOD.AVERAGE:
                return values.reduce((a, b) => a + b, 0) / values.length;
            case METRIC_AGGREGATION_METHOD.MAX:
                return Math.max(...values);
            case METRIC_AGGREGATION_METHOD.MIN:
                return Math.min(...values);
            case METRIC_AGGREGATION_METHOD.SUM:
            default:
                return values.reduce((a, b) => a + b, 0);
        }
    }
    buildActivitiesBlock(day, dateLabel, metricWhitelist, useEntireSessionOnly = false) {
        const activities = day.sportActivities ?? [];
        if (activities.length === 0) {
            return 'Jour de repos';
        }
        const parts = [];
        activities.forEach((activity) => {
            parts.push(`# Activité ${activity.activityName ?? ''} du jour ${dateLabel}`);
            parts.push(`- Type d'activité : ${activity.gameActivity ? 'Match' : 'Entraînement'}`);
            const metricMap = new Map();
            const periods = activity.periods ?? [];
            const entireSessionPeriods = periods.filter((p) => p.name?.toLowerCase().includes('entire session'));
            const periodsForTotal = useEntireSessionOnly && entireSessionPeriods.length > 0 ? entireSessionPeriods : periods;
            periodsForTotal.forEach((period) => {
                const metricValues = period.metricValues ?? [];
                metricValues.forEach((mv) => {
                    const metric = mv.metric;
                    const metricName = metric?.name;
                    if (!metricName || !this.isAllowedPeriodMetric(metricName, metricWhitelist)) {
                        return;
                    }
                    const numericValue = Number(mv.value);
                    if (Number.isNaN(numericValue)) {
                        return;
                    }
                    const existing = metricMap.get(metricName);
                    if (existing) {
                        existing.values.push(numericValue);
                    }
                    else if (metric) {
                        metricMap.set(metricName, { metric, values: [numericValue] });
                    }
                });
            });
            metricMap.forEach(({ metric, values }) => {
                const aggregated = this.aggregateMetricValues(values, metric.aggregationMethod ?? undefined);
                if (aggregated === null)
                    return;
                const processed = postProcessMetric({
                    name: metric.name,
                    value: aggregated,
                    unit: metric.unit ?? null,
                });
                parts.push(`- ${processed.name} : ${processed.value} ${processed.unit ?? ''}`);
            });
            parts.push('');
            parts.push('\t--- Détails des périodes ---');
            periods.forEach((period) => {
                parts.push(`\t- Période : ${period.name ?? 'Sans nom'}`);
                const periodValuesByMetric = new Map();
                (period.metricValues ?? []).forEach((mv) => {
                    const metric = mv.metric;
                    const metricName = metric?.name;
                    if (!metricName || !this.isAllowedPeriodMetric(metricName, metricWhitelist)) {
                        return;
                    }
                    const processed = postProcessMetric({
                        name: metricName,
                        value: mv.value,
                        unit: metric.unit ?? null,
                    });
                    periodValuesByMetric.set(metricName, {
                        name: processed.name,
                        value: processed.value,
                        unit: processed.unit ?? null,
                    });
                });
                metricMap.forEach(({ metric }, metricName) => {
                    const stored = periodValuesByMetric.get(metricName);
                    const name = stored ? stored.name : metricName;
                    const value = stored ? stored.value : 'N/A';
                    const unit = stored ? stored.unit : (metric.unit ?? null);
                    parts.push(`\t\t- ${name} : ${value} ${unit ?? ''}`);
                });
                parts.push('');
            });
        });
        return parts.join('\n').trimEnd();
    }
    isAllowedPeriodMetric(metricName, metricWhitelist) {
        if (metricWhitelist)
            return metricWhitelist.includes(metricName);
        return isChatbotAllowedPeriodMetric(null, metricName);
    }
    getShapForInsight(day, category, insightId) {
        const fi = (day.featureImportances ?? []).find((f) => f.category === category && f.insightId === insightId);
        return fi?.shapValue ?? 0;
    }
    collectInsightIdsForDay(day, category) {
        const ids = new Set();
        for (const f of day.featureImportances ?? []) {
            if (f.category === category && f.insightId != null)
                ids.add(f.insightId);
        }
        return ids;
    }
    getInsightDisplayName(insightId, insightDisplayNameById, featureImportances) {
        const fromMap = insightDisplayNameById.get(insightId);
        if (fromMap)
            return fromMap;
        const fi = featureImportances?.find((f) => f.insightId === insightId);
        const insight = fi?.insight;
        return insight?.name ?? insight?.variableName ?? `Insight ${insightId}`;
    }
    buildShapDailySummaryDriversBlock(params) {
        const { days, referenceDateIso, category, insightDisplayNameById } = params;
        const referenceDay = days.find((d) => d.dateOfDay.toFormat('yyyy-MM-dd') === referenceDateIso);
        const previousDateIso = DateTime.fromFormat(referenceDateIso, 'yyyy-MM-dd')
            .minus({ days: 1 })
            .toFormat('yyyy-MM-dd');
        const previousDay = days.find((d) => d.dateOfDay.toFormat('yyyy-MM-dd') === previousDateIso);
        if (!referenceDay || !previousDay) {
            return '';
        }
        const todayScore = category === 'performance' ? referenceDay.performanceScore : referenceDay.injuryRiskScore;
        const yesterdayScore = category === 'performance' ? previousDay.performanceScore : previousDay.injuryRiskScore;
        if (todayScore === yesterdayScore || todayScore == null || yesterdayScore == null) {
            return '';
        }
        const scoreImproved = category === 'performance' ? todayScore > yesterdayScore : todayScore < yesterdayScore;
        const allInsightIds = new Set([
            ...this.collectInsightIdsForDay(referenceDay, category),
            ...this.collectInsightIdsForDay(previousDay, category),
        ]);
        const rows = [];
        for (const insightId of allInsightIds) {
            const yesterdayShap = this.getShapForInsight(previousDay, category, insightId);
            const todayShap = this.getShapForInsight(referenceDay, category, insightId);
            const delta = todayShap - yesterdayShap;
            rows.push({
                insightId,
                name: this.getInsightDisplayName(insightId, insightDisplayNameById, referenceDay.featureImportances),
                yesterdayShap,
                todayShap,
                delta,
            });
        }
        const top2 = [...rows].sort((a, b) => b.todayShap - a.todayShap).slice(0, 2);
        if (top2.length === 0) {
            return '';
        }
        const skipYesterdayComparison = scoreImproved
            ? top2.every((r) => r.delta > 0)
            : top2.every((r) => r.delta < 0);
        const comparisonTarget = skipYesterdayComparison
            ? null
            : top2.length === 1
                ? top2[0]
                : scoreImproved
                    ? [...top2].sort((a, b) => a.delta - b.delta)[0]
                    : [...top2].sort((a, b) => b.delta - a.delta)[0];
        const directionPhrase = (delta) => {
            if (delta > 0)
                return 'influence ↑ vs hier (Δ SHAP positif)';
            if (delta < 0)
                return 'influence ↓ vs hier (Δ SHAP négatif)';
            return 'influence stable vs hier';
        };
        const driverLines = skipYesterdayComparison
            ? top2.map((r, i) => `${i + 1}. **${r.name}** — contributrice principale aujourd'hui [OBLIGATOIRE Daily Summary FI #${i + 1}] [PAS DE COMPARAISON VS HIER]`)
            : top2.map((r, i) => {
                const sign = r.delta >= 0 ? '+' : '';
                const comparisonTag = comparisonTarget && r.insightId === comparisonTarget.insightId
                    ? ' [COMPARER VS HIER]'
                    : '';
                return `${i + 1}. **${r.name}** — ${directionPhrase(r.delta)} | hier SHAP ${r.yesterdayShap} → aujourd'hui ${r.todayShap} | Δ ${sign}${r.delta} [OBLIGATOIRE Daily Summary FI #${i + 1}]${comparisonTag}`;
            });
        const selectionRuleLine = skipYesterdayComparison
            ? scoreImproved
                ? category === 'injury'
                    ? "Risque en baisse mais les FIs sélectionnées ont toutes un Δ SHAP positif : **aucune** comparaison vs hier (ni Δ, ni influence ↑/↓, ni variables vs hier). Décrire uniquement l'état actuel des deux FIs et 1–2 variables contributrices (tendances récentes : increasing/stable/decreasing)."
                    : "Performance en hausse mais les FIs sélectionnées ont toutes un Δ SHAP positif : **aucune** comparaison vs hier. Décrire uniquement l'état actuel des deux FIs et 1–2 variables contributrices."
                : category === 'injury'
                    ? "Risque en hausse mais les FIs sélectionnées ont toutes un Δ SHAP négatif : **aucune** comparaison vs hier (ni Δ, ni influence ↑/↓, ni variables vs hier). Décrire uniquement l'état actuel des deux FIs et 1–2 variables contributrices (tendances récentes : increasing/stable/decreasing)."
                    : "Performance en baisse mais les FIs sélectionnées ont toutes un Δ SHAP négatif : **aucune** comparaison vs hier. Décrire uniquement l'état actuel des deux FIs et 1–2 variables contributrices."
            : scoreImproved
                ? category === 'injury'
                    ? "Risque en baisse (score plus bas qu'hier) : sélectionner les 2 FIs avec le SHAP le plus élevé aujourd'hui. Puis, pour la comparaison explicite vs hier, utiliser parmi ces deux la FI avec le Δ SHAP le plus petit."
                    : "Performance en hausse : sélectionner les 2 FIs avec le SHAP le plus élevé aujourd'hui. Puis, pour la comparaison explicite vs hier, utiliser parmi ces deux la FI avec le Δ SHAP le plus petit."
                : category === 'injury'
                    ? "Risque en hausse (score plus haut qu'hier) : sélectionner les 2 FIs avec le SHAP le plus élevé aujourd'hui. Puis, pour la comparaison explicite vs hier, utiliser parmi ces deux la FI avec le Δ SHAP le plus grand."
                    : "Performance en baisse : sélectionner les 2 FIs avec le SHAP le plus élevé aujourd'hui. Puis, pour la comparaison explicite vs hier, utiliser parmi ces deux la FI avec le Δ SHAP le plus grand.";
        const instructionLine = skipYesterdayComparison
            ? 'Le daily_report doit mettre en gras **exactement** les deux noms ci-dessous, dans cet ordre (pas selon Priorité). **Interdit** : comparer ces FIs ou leurs variables à hier ; pas de "influence increased/decreased vs yesterday", pas de Δ.'
            : "SHAP manquant ou FI sous Points optimaux = 0 pour ce jour. Le daily_report doit mettre en gras **exactement** les deux noms ci-dessous, dans cet ordre (pas selon Priorité). La FI marquée [COMPARER VS HIER] porte la comparaison explicite vs hier selon le signe de Δ ; l'autre FI : contribution actuelle + 1–2 variables, sans inventer un mouvement vs hier non indiqué.";
        const blockTitle = skipYesterdayComparison
            ? "=== Daily Summary — 2 FIs obligatoires (SHAP aujourd'hui — sans comparaison vs hier) ==="
            : "=== Daily Summary — 2 FIs obligatoires (SHAP aujourd'hui + comparaison vs hier) ===";
        return [blockTitle, selectionRuleLine, instructionLine, ...driverLines, '==='].join('\n');
    }
    async getSharedReportDataPrompt({ athleteId, date, language = APP_LANGUAGES.FR, }) {
        const ctx = await this.loadReportPromptContext({ athleteId, date, language });
        const headerVariables = {
            date: DateTime.fromFormat(date, 'yyyy-MM-dd').toFormat('dd MMMM yyyy'),
            athleteFirstName: ctx.athleteDatas.firstName,
            athleteLastName: ctx.athleteDatas.lastName,
            athleteAge: ctx.athleteDatas.age,
            athleteGender: ctx.athleteDatas.gender,
            athleteHeight: ctx.athleteDatas.heightCm,
            athleteWeight: ctx.athleteDatas.weightKg,
            clubSport: getName(ctx.athleteDatas.club.sport),
            athletePosition: ctx.athleteDatas.playerPosition?.name ?? null,
            categoryRisk: 'la performance et le risque de blessure',
        };
        const header = this.replaceVariables(ctx.athletePrompt.content, headerVariables);
        const glossaryContent = this.replaceVariables(ctx.glossaryPrompt.content, ctx.glossaryVariables);
        const shapDailySummaryDriversBlock = this.buildShapDailySummaryDriversBlock({
            days: ctx.daysWithDates,
            referenceDateIso: date,
            category: 'injury',
            insightDisplayNameById: ctx.insightDisplayNameById,
        });
        const useEntireSessionOnly = usesStatsportsMetricWhitelist(ctx.athleteDatas.clubId);
        const daysBlocks = ctx.daysWithDates
            .map((day) => this.buildSharedDayBlock(day, date, ctx.metricWhitelist, ctx.insightDisplayNameById, useEntireSessionOnly))
            .join('\n\n');
        const shapDriversPart = shapDailySummaryDriversBlock
            ? `${shapDailySummaryDriversBlock}\n\n`
            : '';
        return `${header}\n\n${shapDriversPart}${daysBlocks}\n\n${glossaryContent}`;
    }
    buildSharedDayBlock(day, referenceDateIso, metricWhitelist, insightDisplayNameById, useEntireSessionOnly = false) {
        const dateLabel = day.dateOfDay.toFormat('dd MMMM yyyy');
        const isReferenceDay = day.dateOfDay.toFormat('yyyy-MM-dd') === referenceDateIso;
        const perfImprove = this.buildPointsToImproveBlock(day, 'performance', insightDisplayNameById);
        const perfOptimal = this.buildOptimalPointsBlock(day, 'performance', insightDisplayNameById);
        const injuryImprove = this.buildPointsToImproveBlock(day, 'injury', insightDisplayNameById);
        const injuryOptimal = this.buildOptimalPointsBlock(day, 'injury', insightDisplayNameById);
        const activitiesBlock = isReferenceDay
            ? ''
            : this.buildActivitiesBlock(day, dateLabel, metricWhitelist, useEntireSessionOnly);
        const subjectivesBlock = isReferenceDay ? this.formatPerformanceSubjectivesBlock(day) : '';
        const lines = [
            `## ${dateLabel}`,
            `- Performance score: ${day.performanceScore ?? 'N/A'}`,
            `- Injury risk score: ${day.injuryRiskScore ?? 'N/A'}`,
            '',
            '### Performance — points à améliorer',
            perfImprove || '(aucun)',
            '',
            '### Performance — points optimaux',
            perfOptimal || '(aucun)',
            '',
            '### Injury — points à améliorer',
            injuryImprove || '(aucun)',
            '',
            '### Injury — points optimaux',
            injuryOptimal || '(aucun)',
        ];
        if (activitiesBlock || subjectivesBlock) {
            lines.push('', '### Activités (historique)', activitiesBlock, subjectivesBlock);
        }
        return lines
            .filter((line) => line !== undefined)
            .join('\n')
            .trimEnd();
    }
    async loadReportPromptContext({ athleteId, date, language, }) {
        const athleteDatas = await this.getData({ athleteId, date });
        if (!athleteDatas) {
            throw new Error(`Athlete not found: ${athleteId}`);
        }
        const days = athleteDatas.days ?? [];
        const insightIds = [
            ...new Set(days.flatMap((day) => (day.featureImportances ?? [])
                .map((f) => f.insight?.id)
                .filter((id) => id != null))),
        ];
        const insightDisplayNameById = await this.translationService.getTranslations(TRANSLATABLE_TYPES.INSIGHT, TRANSLATION_KEYS.INSIGHT_NAME, insightIds, language);
        for (const day of days) {
            for (const fi of day.featureImportances ?? []) {
                const insight = fi.insight;
                if (insight && !insightDisplayNameById.has(insight.id)) {
                    insightDisplayNameById.set(insight.id, insight.name ?? insight.variableName);
                }
            }
        }
        const athletePrompt = await Prompt.findBy('title', 'test-chatbot-athlete-infos');
        const glossaryPrompt = await Prompt.findBy('title', 'test-chatbot-glossary-infos');
        if (!athletePrompt || !glossaryPrompt) {
            throw new Error('Test prompt not found: test-chatbot-athlete-infos or test-chatbot-glossary-infos');
        }
        const metricWhitelist = getChatbotMetricWhitelist(athleteDatas.clubId);
        const glossaryVariables = this.buildGlossaryVariables(days, insightDisplayNameById, metricWhitelist);
        const daysWithDates = days.filter((day) => day.dateOfDay != null);
        return {
            athleteDatas,
            days,
            insightDisplayNameById,
            athletePrompt,
            glossaryPrompt,
            glossaryVariables,
            metricWhitelist,
            daysWithDates,
        };
    }
    async getFinalDataPrompt({ athleteId, date, category = 'injury', language = APP_LANGUAGES.FR, }) {
        const athleteDatas = await this.getData({ athleteId, date });
        if (!athleteDatas) {
            throw new Error(`Athlete not found: ${athleteId}`);
        }
        const days = athleteDatas.days ?? [];
        const insightIds = [
            ...new Set(days.flatMap((day) => (day.featureImportances ?? [])
                .map((f) => f.insight?.id)
                .filter((id) => id != null))),
        ];
        const insightDisplayNameById = await this.translationService.getTranslations(TRANSLATABLE_TYPES.INSIGHT, TRANSLATION_KEYS.INSIGHT_NAME, insightIds, language);
        for (const day of days) {
            for (const fi of day.featureImportances ?? []) {
                const insight = fi.insight;
                if (insight && !insightDisplayNameById.has(insight.id)) {
                    insightDisplayNameById.set(insight.id, insight.name ?? insight.variableName);
                }
            }
        }
        const athletePrompt = await Prompt.findBy('title', 'test-chatbot-athlete-infos');
        const dayPromptTemplate = await Prompt.findBy('title', 'test-chatbot-day-infos');
        const glossaryPrompt = await Prompt.findBy('title', 'test-chatbot-glossary-infos');
        if (!athletePrompt || !dayPromptTemplate || !glossaryPrompt) {
            throw new Error(`Test prompt not found: test-chatbot-athlete-infos or test-chatbot-day-infos`);
        }
        const headerVariables = {
            date: DateTime.fromFormat(date, 'yyyy-MM-dd').toFormat('dd MMMM yyyy'),
            athleteFirstName: athleteDatas.firstName,
            athleteLastName: athleteDatas.lastName,
            athleteAge: athleteDatas.age,
            athleteGender: athleteDatas.gender,
            athleteHeight: athleteDatas.heightCm,
            athleteWeight: athleteDatas.weightKg,
            clubSport: getName(athleteDatas.club.sport),
            athletePosition: athleteDatas.playerPosition?.name ?? null,
            categoryRisk: category === 'injury' ? 'le risque de blessure' : 'le taux de performance',
        };
        const header = this.replaceVariables(athletePrompt.content, headerVariables);
        const metricWhitelist = getChatbotMetricWhitelist(athleteDatas.clubId);
        const useEntireSessionOnly = usesStatsportsMetricWhitelist(athleteDatas.clubId);
        const glossaryVariables = this.buildGlossaryVariables(days, insightDisplayNameById, metricWhitelist);
        const glossaryContent = this.replaceVariables(glossaryPrompt.content, glossaryVariables);
        let targetDay = null;
        const daysWithDates = days.filter((day) => day.dateOfDay != null);
        const shapDailySummaryDriversBlock = category === 'injury'
            ? this.buildShapDailySummaryDriversBlock({
                days: daysWithDates,
                referenceDateIso: date,
                category,
                insightDisplayNameById,
            })
            : '';
        const daysBlocks = daysWithDates
            .map((day) => {
            const dateLabel = day.dateOfDay.toFormat('dd MMMM yyyy');
            const isReferenceDay = day.dateOfDay.toFormat('yyyy-MM-dd') === date;
            if (!targetDay && isReferenceDay) {
                targetDay = day;
            }
            const pointsToImproveBlock = this.buildPointsToImproveBlock(day, category, insightDisplayNameById);
            const optimalPointsBlock = this.buildOptimalPointsBlock(day, category, insightDisplayNameById);
            const activitiesBlock = isReferenceDay
                ? ''
                : this.buildActivitiesBlock(day, dateLabel, metricWhitelist, useEntireSessionOnly);
            const subjectivesBlock = isReferenceDay ? '' : this.formatPerformanceSubjectivesBlock(day);
            const activitiesAndSubjectivesBlock = `${activitiesBlock}${subjectivesBlock ? `\n\n${subjectivesBlock}` : ''}`;
            const dayVariables = {
                currentDate: dateLabel,
                categoryRisk: headerVariables.categoryRisk,
                score: category === 'performance' ? day.performanceScore : day.injuryRiskScore,
                increaseOrDecrease: category === 'performance'
                    ? 'diminuent la performance'
                    : 'augmentent le risque de blessure',
                pointsToImproveBlock,
                optimalPointsBlock,
                activitiesBlock: activitiesAndSubjectivesBlock,
            };
            return this.replaceVariables(dayPromptTemplate.content, dayVariables);
        })
            .join('\n\n');
        const reportBlock = await this.buildReportBlock(targetDay, category);
        const shapDriversPart = shapDailySummaryDriversBlock
            ? `${shapDailySummaryDriversBlock}\n\n`
            : '';
        const finalPrompt = `${header}\n\n${shapDriversPart}${daysBlocks}\n\n${glossaryContent}${reportBlock}`;
        console.log('finalPrompt: ', finalPrompt);
        console.log('length: ', finalPrompt.length);
        return finalPrompt;
    }
    async buildReportBlock(targetDay, category) {
        if (!targetDay) {
            return '';
        }
        const latestReport = await ChatbotReport.latestForDay(targetDay.id, category);
        if (!latestReport?.message) {
            return '';
        }
        return `\n\n=== Report of the day (${category}) ===\n${latestReport.message}`;
    }
    buildGlossaryVariables(days, insightDisplayNameById, metricWhitelist) {
        const filteredSet = new Set(CHATBOT_FILTERED_PERIOD_METRICS);
        const insightById = new Map();
        const periodMetricsByName = new Map();
        const dayMetricsByName = new Map();
        for (const day of days) {
            for (const fi of day.featureImportances ?? []) {
                const insight = fi.insight;
                if (insight && !insightById.has(insight.id)) {
                    insightById.set(insight.id, insight);
                }
            }
            for (const dmv of day.metricValues ?? []) {
                const metric = dmv.metric;
                const name = metric?.name;
                if (name && !dayMetricsByName.has(name) && metric) {
                    dayMetricsByName.set(name, metric);
                }
            }
            for (const activity of day.sportActivities ?? []) {
                for (const period of activity.periods ?? []) {
                    for (const mv of period.metricValues ?? []) {
                        const metric = mv.metric;
                        const name = metric?.name;
                        if (!name || periodMetricsByName.has(name))
                            continue;
                        if (metricWhitelist) {
                            if (!metricWhitelist.includes(name))
                                continue;
                        }
                        else if (filteredSet.has(name)) {
                            continue;
                        }
                        if (metric)
                            periodMetricsByName.set(name, metric);
                    }
                }
            }
        }
        const insightDescriptions = Array.from(insightById.values())
            .map((i) => `- ${insightDisplayNameById.get(i.id) ?? i.name ?? i.variableName}: ${i.description}`)
            .join('\n');
        const periodMetricDescriptions = Array.from(periodMetricsByName.values())
            .map((m) => `- ${m.name}: ${m.description ?? ''}${m.unit ? ` (unité : ${m.unit})` : ''}`)
            .join('\n');
        const tlFactorDescriptions = Array.from(dayMetricsByName.entries())
            .map(([, m]) => `- ${m.name}: ${m.description ?? ''}${m.unit ? ` (unité : ${m.unit})` : ''}`)
            .join('\n');
        return { insightDescriptions, periodMetricDescriptions, tlFactorDescriptions };
    }
    async getData({ athleteId, date }) {
        const athlete = await Athlete.query()
            .where('id', athleteId)
            .preload('days', (daysQuery) => {
            daysQuery
                .orderBy('dateOfDay', 'desc')
                .preload('metricValues', (metricValuesQuery) => {
                metricValuesQuery.preload('metric');
            })
                .preload('featureImportances', (featureImportancesQuery) => {
                featureImportancesQuery.preload('insight');
            })
                .preload('sportActivities', (sportActivitiesQuery) => {
                sportActivitiesQuery.preload('sport').preload('periods', (periodsQuery) => {
                    periodsQuery.preload('metricValues', (metricValuesQuery) => {
                        metricValuesQuery.preload('metric');
                    });
                });
            })
                .preload('sleeps', (sleepsQuery) => {
                sleepsQuery.orderBy('createdAt', 'desc');
            })
                .preload('health', (healthQuery) => {
                healthQuery.preload('metricValues', (metricValuesQuery) => {
                    metricValuesQuery.preload('metric');
                });
            })
                .where('dateOfDay', '>=', DateTime.fromFormat(date, 'yyyy-MM-dd').minus({ days: 7 }).toJSDate())
                .where('dateOfDay', '<=', DateTime.fromFormat(date, 'yyyy-MM-dd').toJSDate());
        })
            .preload('club', (clubQuery) => {
            clubQuery.preload('seasons').preload('sport');
        })
            .preload('playerPosition')
            .first();
        return athlete;
    }
}
//# sourceMappingURL=prompt_service.js.map