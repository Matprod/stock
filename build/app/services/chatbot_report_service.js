import ChatbotReport from '#models_pg/chatbot_report';
import Athlete from '#models_pg/athlete';
import Prompt from '#models_pg/prompt';
import { Claude35SonnetService } from '#services/llm/claude_3.5_sonnet_service';
import Club from '#models_pg/club';
import AthleteService from '#services/athlete_service';
import ChatbotService from '#services/chatbot_service';
import ThresholdsService from '#services/thresholds_service';
import { DateTime } from 'luxon';
import { cleanJsonResponse } from '../utils/chatbot_result.js';
import { CATEGORY_REPORT_FOCUS, isSunderlandClub, isChatbotMlClub, } from '#constants/chatbot.constants';
export default class ChatbotReportService {
    static SCORE_DIFFERENCE_THRESHOLD = 5;
    claude35SonnetService;
    athleteService;
    chatbotService;
    thresholdsService;
    constructor() {
        this.claude35SonnetService = new Claude35SonnetService();
        this.athleteService = new AthleteService();
        this.chatbotService = new ChatbotService();
        this.thresholdsService = new ThresholdsService();
    }
    async getReport(dayId, category) {
        return ChatbotReport.latestForDay(dayId, category);
    }
    shouldRegenerateReport(latestReport, currentScore) {
        if (currentScore === null || currentScore === undefined)
            return false;
        if (!latestReport || latestReport.scoreAtGeneration === null)
            return true;
        return (Math.abs(currentScore - latestReport.scoreAtGeneration) >
            ChatbotReportService.SCORE_DIFFERENCE_THRESHOLD);
    }
    async generateReport(athlete, day, date, category, currentScore) {
        const club = await Club.query().where('id', athlete.clubId).first();
        const language = club?.language || 'en';
        const isSunderland = isSunderlandClub(club?.id);
        const { promptTitle, systemPromptTitle } = this.reportPromptTitles(category, isSunderland);
        const prompts = await Prompt.query().whereIn('title', [promptTitle, systemPromptTitle]);
        const promptTemplate = prompts.find((p) => p.title === promptTitle);
        const systemPromptTemplate = prompts.find((p) => p.title === systemPromptTitle);
        if (!promptTemplate || !systemPromptTemplate) {
            throw new Error(`Prompt not found: ${promptTitle} or ${systemPromptTitle}`);
        }
        const nutrition = await this.athleteService.getLastSevenDaysMacros(athlete.id, date);
        const dataPrompt = await this.chatbotService.getFinalDataPrompt({
            athlete,
            category,
            nutrition,
            date,
            language,
        });
        const fullLanguage = language === 'fr' ? 'français' : 'English';
        const prompt = `Réponds en ${fullLanguage}, ${this.fillReportUserPrompt(promptTemplate.content, athlete, date, fullLanguage)}`;
        const reportMessage = await this.claude35SonnetService.generateResponse({
            systemPrompt: systemPromptTemplate.content,
            dataPrompt,
            prompt,
            history: [],
        });
        return this.persistReport(day.id, category, currentScore, reportMessage);
    }
    shouldGenerateReport(category, score, thresholds) {
        if (score === null || score === undefined)
            return false;
        if (category === 'injury')
            return score >= thresholds.injury.medium;
        return score <= thresholds.performance.medium;
    }
    async generateReportsWithSharedCache(athlete, day, date, categories, options) {
        if (!isChatbotMlClub(athlete.clubId)) {
            throw new Error('Shared report cache requires an ML club (Sunderland/Hamburg)');
        }
        const force = options?.force === true;
        let eligibleCategories = categories;
        if (!force) {
            const { thresholds } = await this.thresholdsService.getThresholdsByClubId(athlete.clubId);
            eligibleCategories = categories.filter((category) => {
                const score = category === 'performance' ? (day.performanceScore ?? null) : (day.injuryRiskScore ?? null);
                return this.shouldGenerateReport(category, score, thresholds);
            });
        }
        if (eligibleCategories.length === 0)
            return [];
        const club = await Club.query().where('id', athlete.clubId).first();
        const language = club?.language || 'en';
        const isSunderland = isSunderlandClub(club?.id);
        const fullLanguage = language === 'fr' ? 'français' : 'English';
        const sharedDataPrompt = await this.chatbotService.getSharedReportDataPrompt({
            athlete,
            date,
            language: club?.language,
        });
        const sharedSystemPrompt = await this.resolveSharedReportSystemPrompt(isSunderland);
        const generated = [];
        for (const category of ['performance', 'injury'].filter((c) => eligibleCategories.includes(c))) {
            const { promptTitle } = this.reportPromptTitles(category, isSunderland);
            const promptTemplate = await Prompt.findBy('title', promptTitle);
            if (!promptTemplate)
                throw new Error(`Prompt not found: ${promptTitle}`);
            const previousReport = await this.getReport(day.id, category);
            const prompt = [
                CATEGORY_REPORT_FOCUS[category],
                `Réponds en ${fullLanguage}, ${this.fillReportUserPrompt(promptTemplate.content, athlete, date, fullLanguage)}`,
                previousReport?.message
                    ? `\n\n=== Report of the day (${category}) ===\n${previousReport.message}`
                    : '',
            ]
                .filter(Boolean)
                .join('\n\n');
            const score = category === 'performance' ? (day.performanceScore ?? null) : (day.injuryRiskScore ?? null);
            const reportMessage = await this.claude35SonnetService.generateResponse({
                systemPrompt: sharedSystemPrompt,
                dataPrompt: sharedDataPrompt,
                prompt,
                history: [],
            });
            await this.persistReport(day.id, category, score, reportMessage);
            generated.push(category);
        }
        return generated;
    }
    reportPromptTitles(category, isSunderland) {
        if (isSunderland) {
            return category === 'performance'
                ? {
                    promptTitle: 'performance_report_sunderland',
                    systemPromptTitle: 'performance_report_prompt_sunderland',
                }
                : {
                    promptTitle: 'injury_report_prompt_sunderland',
                    systemPromptTitle: 'injury_system_prompt_sunderland_report',
                };
        }
        return category === 'performance'
            ? { promptTitle: 'performance-report', systemPromptTitle: 'performance-report-prompt' }
            : { promptTitle: 'injury-report', systemPromptTitle: 'injury-report-prompt' };
    }
    fillReportUserPrompt(template, athlete, date, fullLanguage) {
        return template
            .replace('{athlete_name}', athlete.name || 'the athlete')
            .replace('{date}', date)
            .replace('{language}', fullLanguage);
    }
    async resolveSharedReportSystemPrompt(isSunderland) {
        const titles = isSunderland
            ? [
                'performance_report_prompt_sunderland',
                'injury_system_prompt_sunderland_report',
            ]
            : ['performance-report-prompt', 'injury-report-prompt'];
        const prompts = await Prompt.query().whereIn('title', [...titles]);
        const performance = prompts.find((p) => p.title === titles[0]);
        const injury = prompts.find((p) => p.title === titles[1]);
        if (!performance || !injury) {
            throw new Error(`Shared report system prompts not found: ${titles.join(', ')}`);
        }
        return [
            '=== PERFORMANCE REPORT (system) ===',
            performance.content.trim(),
            '',
            '=== INJURY REPORT (system) ===',
            injury.content.trim(),
            '',
            'The user message specifies which single report to generate for this request.',
        ].join('\n');
    }
    async persistReport(dayId, category, currentScore, reportMessage) {
        let parsedResult = null;
        try {
            parsedResult = JSON.parse(reportMessage);
        }
        catch {
            try {
                parsedResult = JSON.parse(cleanJsonResponse(reportMessage));
            }
            catch (secondError) {
                console.error('Failed to parse JSON:', secondError, 'Raw result:', reportMessage);
            }
        }
        const fullReport = typeof parsedResult?.full_report === 'string' && parsedResult.full_report.trim().length > 0
            ? parsedResult.full_report
            : null;
        const dailyReport = typeof parsedResult?.daily_report === 'string' && parsedResult.daily_report.trim().length > 0
            ? parsedResult.daily_report
            : null;
        const message = fullReport ?? dailyReport ?? reportMessage;
        if (!message || !String(message).trim()) {
            throw new Error(`Empty LLM report message for ${category} (day=${dayId}). Raw length=${reportMessage?.length ?? 0}`);
        }
        return ChatbotReport.create({
            dayId,
            category,
            message,
            scoreAtGeneration: currentScore,
            summary: dailyReport,
        });
    }
    async generateReportIfNeeded(athleteId, day, currentScore, category, force = false) {
        if (currentScore === null || currentScore === undefined)
            return false;
        const date = day.dateOfDay?.toFormat('yyyy-MM-dd');
        const today = DateTime.now().toFormat('yyyy-MM-dd');
        if (!date || date > today)
            return false;
        const athlete = await Athlete.query().where('id', athleteId).select(['id', 'clubId']).first();
        if (!athlete)
            return false;
        if (!force) {
            const { thresholds } = await this.thresholdsService.getThresholdsByClubId(athlete.clubId);
            if (!this.shouldGenerateReport(category, currentScore, thresholds))
                return false;
            const existingReport = await this.getReport(day.id, category);
            if (!this.shouldRegenerateReport(existingReport, currentScore))
                return false;
        }
        try {
            const athleteWithDetails = await this.athleteService.getAthleteWithDetails({
                athleteId,
                days: 7,
                startDate: date,
            });
            if (!athleteWithDetails)
                return false;
            await this.generateReport(athleteWithDetails, day, date, category, currentScore);
            return true;
        }
        catch (error) {
            console.error(`Failed to generate ${category} report for day ${day.id}:`, error);
            return false;
        }
    }
}
//# sourceMappingURL=chatbot_report_service.js.map