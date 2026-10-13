import ChatbotReport from '#models_pg/chatbot_report'
import Day from '#models_pg/day'
import Athlete from '#models_pg/athlete'
import Prompt from '#models_pg/prompt'
import { Claude35SonnetService } from '#services/llm/claude_3.5_sonnet_service'
import Club from '#models_pg/club'
import AthleteService from '#services/athlete_service'
import ChatbotService from '#services/chatbot_service'
import ThresholdsService from '#services/thresholds_service'
import { INSIGHT_CATEGORIES, type PredictionType } from '#constants/insight.constants'
import type { ThresholdsPayload } from '#contracts/thresholds'
import { DateTime } from 'luxon'
import { parseChatbotReportPayload } from '../utils/chatbot_result.js'
import {
  CATEGORY_REPORT_FOCUS,
  isSunderlandClub,
  isChatbotMlClub,
} from '#constants/chatbot.constants'

export interface ChatbotReportRegenerateOptions {
  clubId: string
  from: string
  to: string
  athleteIds?: string[]
  categories?: PredictionType[]
  dryRun?: boolean
}

export interface ChatbotReportRegenerateResult {
  dryRun: boolean
  from: string
  to: string
  clubId: string
  athletes: number
  days: number
  eligible: number
  generated: number
  failed: number
  skippedNoScore: number
  skippedFilter: number
}

export default class ChatbotReportService {
  private static readonly SCORE_DIFFERENCE_THRESHOLD = 5

  private claude35SonnetService: Claude35SonnetService
  private athleteService: AthleteService
  private chatbotService: ChatbotService
  private thresholdsService: ThresholdsService

  constructor() {
    this.claude35SonnetService = new Claude35SonnetService()
    this.athleteService = new AthleteService()
    this.chatbotService = new ChatbotService()
    this.thresholdsService = new ThresholdsService()
  }

  async getReport(dayId: string, category: PredictionType): Promise<ChatbotReport | null> {
    return ChatbotReport.latestForDay(dayId, category)
  }

  shouldRegenerateReport(latestReport: ChatbotReport | null, currentScore: number | null): boolean {
    if (currentScore === null || currentScore === undefined) return false
    if (!latestReport || latestReport.scoreAtGeneration === null) return true
    return (
      Math.abs(currentScore - latestReport.scoreAtGeneration) >
      ChatbotReportService.SCORE_DIFFERENCE_THRESHOLD
    )
  }

  async generateReport(
    athlete: Athlete,
    day: Day,
    date: string,
    category: PredictionType,
    currentScore: number | null
  ): Promise<ChatbotReport> {
    const club = await Club.query().where('id', athlete.clubId).first()
    const language = club?.language || 'en'
    const isSunderland = isSunderlandClub(club?.id)

    const { promptTitle, systemPromptTitle } = this.reportPromptTitles(category, isSunderland)
    const prompts = await Prompt.query().whereIn('title', [promptTitle, systemPromptTitle])
    const promptTemplate = prompts.find((p) => p.title === promptTitle)
    const systemPromptTemplate = prompts.find((p) => p.title === systemPromptTitle)
    if (!promptTemplate || !systemPromptTemplate) {
      throw new Error(`Prompt not found: ${promptTitle} or ${systemPromptTitle}`)
    }

    const nutrition = await this.athleteService.getLastSevenDaysMacros(athlete.id, date)
    const dataPrompt = await this.chatbotService.getFinalDataPrompt({
      athlete,
      category,
      nutrition,
      date,
      language,
    })

    const fullLanguage = language === 'fr' ? 'français' : 'English'
    const prompt = `Réponds en ${fullLanguage}, ${this.fillReportUserPrompt(promptTemplate.content, athlete, date, fullLanguage)}`

    const reportMessage = await this.claude35SonnetService.generateResponse({
      systemPrompt: systemPromptTemplate.content,
      dataPrompt,
      prompt,
      history: [],
    })

    return this.persistReport(day.id, category, currentScore, reportMessage)
  }

  private shouldGenerateReport(
    category: PredictionType,
    score: number | null,
    thresholds: ThresholdsPayload
  ): boolean {
    if (score === null || score === undefined) return false
    if (category === 'injury') return score >= thresholds.injury.high
    return score <= thresholds.performance.medium
  }

  async generateReportsWithSharedCache(
    athlete: Athlete,
    day: Day,
    date: string,
    categories: PredictionType[],
    options?: { force?: boolean }
  ): Promise<PredictionType[]> {
    if (!isChatbotMlClub(athlete.clubId)) {
      throw new Error('Shared report cache requires an ML club (Sunderland/Hamburg)')
    }

    const force = options?.force === true
    let eligibleCategories = categories

    if (!force) {
      const { thresholds } = await this.thresholdsService.getThresholdsByClubId(athlete.clubId)
      eligibleCategories = categories.filter((category) => {
        const score =
          category === 'performance'
            ? (day.performanceScore ?? null)
            : (day.injuryRiskScore ?? null)
        return this.shouldGenerateReport(category, score, thresholds)
      })
    }
    if (eligibleCategories.length === 0) return []

    const club = await Club.query().where('id', athlete.clubId).first()
    const language = club?.language || 'en'
    const isSunderland = isSunderlandClub(club?.id)
    const fullLanguage = language === 'fr' ? 'français' : 'English'

    const sharedDataPrompt = await this.chatbotService.getSharedReportDataPrompt({
      athlete,
      date,
      language: club?.language,
    })
    const sharedSystemPrompt = await this.resolveSharedReportSystemPrompt(isSunderland)

    const generated: PredictionType[] = []
    for (const category of (['performance', 'injury'] as const).filter((c) =>
      eligibleCategories.includes(c)
    )) {
      const { promptTitle } = this.reportPromptTitles(category, isSunderland)
      const promptTemplate = await Prompt.findBy('title', promptTitle)
      if (!promptTemplate) throw new Error(`Prompt not found: ${promptTitle}`)

      const previousReport = await this.getReport(day.id, category)
      const prompt = [
        CATEGORY_REPORT_FOCUS[category],
        `Réponds en ${fullLanguage}, ${this.fillReportUserPrompt(promptTemplate.content, athlete, date, fullLanguage)}`,
        previousReport?.message
          ? `\n\n=== Report of the day (${category}) ===\n${previousReport.message}`
          : '',
      ]
        .filter(Boolean)
        .join('\n\n')

      const score =
        category === 'performance' ? (day.performanceScore ?? null) : (day.injuryRiskScore ?? null)

      const reportMessage = await this.claude35SonnetService.generateResponse({
        systemPrompt: sharedSystemPrompt,
        dataPrompt: sharedDataPrompt,
        prompt,
        history: [],
      })

      await this.persistReport(day.id, category, score, reportMessage)
      generated.push(category)
    }

    return generated
  }

  private reportPromptTitles(category: PredictionType, isSunderland: boolean) {
    if (isSunderland) {
      return category === 'performance'
        ? {
            promptTitle: 'performance_report_sunderland',
            systemPromptTitle: 'performance_report_prompt_sunderland',
          }
        : {
            promptTitle: 'injury_report_prompt_sunderland',
            systemPromptTitle: 'injury_system_prompt_sunderland_report',
          }
    }
    return category === 'performance'
      ? { promptTitle: 'performance-report', systemPromptTitle: 'performance-report-prompt' }
      : { promptTitle: 'injury-report', systemPromptTitle: 'injury-report-prompt' }
  }

  private fillReportUserPrompt(
    template: string,
    athlete: Athlete,
    date: string,
    fullLanguage: string
  ): string {
    return template
      .replace('{athlete_name}', athlete.name || 'the athlete')
      .replace('{date}', date)
      .replace('{language}', fullLanguage)
  }

  private async resolveSharedReportSystemPrompt(isSunderland: boolean): Promise<string> {
    const titles = isSunderland
      ? ([
          'performance_report_prompt_sunderland',
          'injury_system_prompt_sunderland_report',
        ] as const)
      : (['performance-report-prompt', 'injury-report-prompt'] as const)

    const prompts = await Prompt.query().whereIn('title', [...titles])
    const performance = prompts.find((p) => p.title === titles[0])
    const injury = prompts.find((p) => p.title === titles[1])
    if (!performance || !injury) {
      throw new Error(`Shared report system prompts not found: ${titles.join(', ')}`)
    }

    return [
      '=== PERFORMANCE REPORT (system) ===',
      performance.content.trim(),
      '',
      '=== INJURY REPORT (system) ===',
      injury.content.trim(),
      '',
      'The user message specifies which single report to generate for this request.',
    ].join('\n')
  }

  private async persistReport(
    dayId: string,
    category: PredictionType,
    currentScore: number | null,
    reportMessage: string
  ): Promise<ChatbotReport> {
    const parsedResult = parseChatbotReportPayload(reportMessage)
    const fullReport =
      typeof parsedResult?.full_report === 'string' && parsedResult.full_report.trim().length > 0
        ? parsedResult.full_report
        : null
    const dailyReport =
      typeof parsedResult?.daily_report === 'string' && parsedResult.daily_report.trim().length > 0
        ? parsedResult.daily_report
        : null

    const message = fullReport ?? dailyReport
    if (!message) {
      throw new Error(
        `Unparseable LLM report JSON for ${category} (day=${dayId}). Raw length=${reportMessage?.length ?? 0}`
      )
    }

    return ChatbotReport.create({
      dayId,
      category,
      message,
      scoreAtGeneration: currentScore,
      summary: dailyReport,
    })
  }

  async regenerateForClubRange(
    options: ChatbotReportRegenerateOptions
  ): Promise<ChatbotReportRegenerateResult> {
    const from = DateTime.fromISO(options.from, { zone: 'utc' }).startOf('day')
    const to = DateTime.fromISO(options.to, { zone: 'utc' }).startOf('day')
    if (!from.isValid || !to.isValid || to < from) {
      throw new Error(`Invalid range ${options.from} → ${options.to}`)
    }
    if (!isChatbotMlClub(options.clubId)) {
      throw new Error('Daily report regeneration is only available for ML clubs')
    }

    const today = DateTime.utc().startOf('day')
    const end = to > today ? today : to
    const fromIso = from.toISODate()!
    const endIso = end.toISODate()!
    const dryRun = options.dryRun === true
    const wantedCategories = options.categories?.length
      ? options.categories
      : [...INSIGHT_CATEGORIES]

    const athletesQuery = Athlete.query().where('clubId', options.clubId)
    if (options.athleteIds?.length) {
      athletesQuery.whereIn('id', options.athleteIds)
    }
    const athletes = await athletesQuery
    const athleteById = new Map(athletes.map((athlete) => [athlete.id, athlete]))
    const athleteIds = [...athleteById.keys()]

    const result: ChatbotReportRegenerateResult = {
      dryRun,
      from: fromIso,
      to: endIso,
      clubId: options.clubId,
      athletes: athleteIds.length,
      days: 0,
      eligible: 0,
      generated: 0,
      failed: 0,
      skippedNoScore: 0,
      skippedFilter: 0,
    }

    if (athleteIds.length === 0) return result

    const days = await Day.query()
      .whereIn('athleteId', athleteIds)
      .where('dateOfDay', '>=', fromIso)
      .where('dateOfDay', '<=', endIso)
      .orderBy('dateOfDay', 'asc')
    result.days = days.length

    const { thresholds } = await this.thresholdsService.getThresholdsByClubId(options.clubId)

    for (const day of days) {
      const athlete = athleteById.get(day.athleteId)
      const date = day.dateOfDay?.toFormat('yyyy-MM-dd')
      if (!athlete || !date) continue

      const scored = wantedCategories.filter((category) => {
        const score =
          category === 'performance'
            ? (day.performanceScore ?? null)
            : (day.injuryRiskScore ?? null)
        return score !== null && score !== undefined
      })
      if (scored.length === 0) {
        result.skippedNoScore++
        continue
      }

      const eligible = scored.filter((category) => {
        const score =
          category === 'performance'
            ? (day.performanceScore ?? null)
            : (day.injuryRiskScore ?? null)
        return this.shouldGenerateReport(category, score, thresholds)
      })
      if (eligible.length === 0) {
        result.skippedFilter++
        continue
      }

      result.eligible++
      if (dryRun) continue

      try {
        const generated = await this.generateReportsWithSharedCache(athlete, day, date, eligible, {
          force: false,
        })
        result.generated += generated.length
        if (generated.length === 0) result.skippedFilter++
      } catch (error) {
        result.failed++
        console.error(
          `Failed chatbot report regen athlete=${athlete.id} date=${date}:`,
          error instanceof Error ? error.message : error
        )
      }
    }

    return result
  }

  async generateReportIfNeeded(
    athleteId: string,
    day: Day,
    currentScore: number | null,
    category: PredictionType,
    force: boolean = false
  ): Promise<boolean> {
    if (currentScore === null || currentScore === undefined) return false

    const date = day.dateOfDay?.toFormat('yyyy-MM-dd')
    const today = DateTime.now().toFormat('yyyy-MM-dd')
    if (!date || date > today) return false

    const athlete = await Athlete.query().where('id', athleteId).select(['id', 'clubId']).first()
    if (!athlete) return false

    if (!force) {
      const { thresholds } = await this.thresholdsService.getThresholdsByClubId(athlete.clubId)
      if (!this.shouldGenerateReport(category, currentScore, thresholds)) return false

      const existingReport = await this.getReport(day.id, category)
      if (!this.shouldRegenerateReport(existingReport, currentScore)) return false
    }

    try {
      const athleteWithDetails = await this.athleteService.getAthleteWithDetails({
        athleteId,
        days: 7,
        startDate: date,
      })
      if (!athleteWithDetails) return false
      await this.generateReport(athleteWithDetails, day, date, category, currentScore)
      return true
    } catch (error) {
      console.error(`Failed to generate ${category} report for day ${day.id}:`, error)
      return false
    }
  }
}
