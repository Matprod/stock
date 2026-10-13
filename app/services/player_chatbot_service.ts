import { PLAYER_CHATBOT_PROMPT_TITLES } from '#constants/agent.constants'
import AthleteService from '#services/athlete_service'
import MilitaryProtocolService from '#services/military_protocol_service'
import Prompt from '#models_pg/prompt'
import { ChatCategory, ClassificationResult } from '#contracts/chatbot'
import { GroqService } from '#services/llm/groq_service'
import Athlete from '#models_pg/athlete'
import SportActivity from '#models_pg/sport_activity'
import ChatbotService from '#services/chatbot_service'
import OrchestratorService from '#services/orchestrator_service'
import { DateTime } from 'luxon'
import { GPTService } from '#services/llm/gpt_service'
import { parseMicrosecondsToDuration, parseSecondsToDuration } from '../utils/time.js'
import { cleanJsonResponse } from '../utils/chatbot_result.js'
import { encode } from '@toon-format/toon'
import NutritionService from '#services/nutrition_service'
import Day from '#models_pg/day'

interface HealthDataEntry {
  date: string | null
  moodRating: number | null
  energyRating: number | null
  relaxRating: number | null
}

interface BasketballGameMetrics {
  gameName: string | null
  matchResult: string | null
  points: number | null
  minutesPlayed: number | null
  twoPointsMade: number | null
  threePointsMade: number | null
  freeThrowsMade: number | null
  assists: number | null
  rebounds: number | null
  jumps: number | null
}

interface ActivityDataEntry {
  date?: string | null
  activityName: string | null
  sportType: string | null
  activityDuration: string | null
  activityTrainingLoad: number | null
  activityRpe: number | null
  activityActiveCalories: string | null
  activityDistance: string | null
  activityAveragePace: string | null
  activityAverageBpm: string | null
  heartRateZones?: string | null
  basketballGame?: BasketballGameMetrics
}

interface SleepDataEntry {
  qualityRating: number | null
  duration: string | null
  sleepEfficiencyPercentage: number | null
  totalInBedTimeMilli: number | null
  totalAwakeTimeMilli: number | null
  baselineMili: number | null
  bedtimeDate: string | null
  wakeUpDate: string | null
}

interface CategoryResponse {
  category: string
  response: string
}

interface GenerateResponseParams {
  prompt: string
  date: string
  discussionId?: string
  athleteId: string
  userId?: string
}

interface GenerateResponseResult {
  response: string
  discussionId: string
  questions: string[]
  classified: string
}

export default class PlayerChatbotService {
  private athleteService: AthleteService
  private chatbotService: ChatbotService
  private groqService: GroqService
  private orchestrator: OrchestratorService
  private militaryProtocolService: MilitaryProtocolService
  private gptService: GPTService
  private nutritionService: NutritionService

  constructor() {
    this.athleteService = new AthleteService()
    this.chatbotService = new ChatbotService()
    this.groqService = new GroqService()
    this.orchestrator = new OrchestratorService()
    this.militaryProtocolService = new MilitaryProtocolService()
    this.gptService = new GPTService()
    this.nutritionService = new NutritionService()
  }

  private extractBasketballGameMetrics(activity: SportActivity): BasketballGameMetrics | null {
    if (activity.dataSource !== 'api_basket' || !activity.periods?.length) return null

    const period = activity.periods[0]
    const m = Object.fromEntries(
      (period.metricValues || [])
        .filter((mv) => mv.metric?.name)
        .map((mv) => [mv.metric!.name, mv.value])
    )
    const toNumber = (key: string) => (m[key] ? Number(m[key]) : null)

    return {
      gameName: period.name || null,
      matchResult: m['basketball_match_result'] || null,
      points: toNumber('basketball_points'),
      minutesPlayed: toNumber('basketball_minutes'),
      twoPointsMade: toNumber('basketball_2pm'),
      threePointsMade: toNumber('basketball_3pm'),
      freeThrowsMade: toNumber('basketball_ftm'),
      assists: toNumber('basketball_assists'),
      rebounds: toNumber('basketball_rebounds'),
      jumps: toNumber('basketball_jumps'),
    }
  }

  private async getSkippedMealsForDate(
    athleteId: string,
    date: string | DateTime
  ): Promise<Record<string, boolean>> {
    const dateObj = typeof date === 'string' ? DateTime.fromISO(date) : date
    const day = await Day.query()
      .where('athleteId', athleteId)
      .where('dateOfDay', dateObj.toJSDate())
      .first()

    if (!day) return {}
    return this.nutritionService.getSkippedMeals(day.id)
  }

  public async generateResponse(params: GenerateResponseParams): Promise<GenerateResponseResult> {
    const { prompt, date, discussionId, athleteId, userId } = params

    const athlete = await this.athleteService.getAthleteWithDetails({
      athleteId,
      days: 7,
      startDate: date,
    })

    if (!athlete) {
      throw new Error('Athlète non trouvé')
    }

    const language = athlete.appLanguage || 'en'

    const currentDiscussion = discussionId
      ? await this.chatbotService.getDiscussion(discussionId)
      : null

    let currentDiscussionId = discussionId ? discussionId : null
    if (currentDiscussionId === null) {
      const title = await this.generateDiscussionTitle(prompt)
      const discussion = await this.chatbotService.createDiscussion({
        userId,
        dayId: date,
        title,
        athleteId,
      })
      currentDiscussionId = discussion.id
    }

    const history =
      (currentDiscussion?.messages.map((message) => ({
        role: message.author === 'bot' ? 'assistant' : 'user',
        content: message.content,
      })) as Array<{ role: 'user' | 'assistant'; content: string }>) || []

    await this.chatbotService.addMessage(currentDiscussionId, prompt, 'user')
    const promptWithLanguage = `Réponds en ${language}, ${prompt}`

    // Classify prompt and generate response
    const { aiResponse, questions } = await this.processPromptClassification(
      prompt,
      promptWithLanguage,
      history,
      athleteId,
      date,
      athlete,
      language
    )

    await this.chatbotService.addMessage(currentDiscussionId, aiResponse, 'bot')

    return {
      response: aiResponse,
      discussionId: currentDiscussionId,
      questions: questions,
      classified: 'general',
    }
  }

  private async processPromptClassification(
    prompt: string,
    promptWithLanguage: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    athleteId: string,
    date: string,
    athlete: Athlete,
    language: string
  ): Promise<{ aiResponse: string; questions: string[] }> {
    // Classify prompt with Groq
    let classification: ClassificationResult
    try {
      classification = await this.groqService.classify(prompt, history, language)
    } catch (error) {
      console.error('Failed to classify prompt with Groq:', error)
      const fallbackMessage = language === 'fr' ? 'Désolé, réessaye' : 'Sorry, Could you try again?'
      return { aiResponse: fallbackMessage, questions: [] }
    }

    let aiResponse = ''
    let questions: string[] = []

    if (classification.kind === 'general') {
      aiResponse = classification.response
    } else {
      try {
        // Generate expert response using Claude
        const categoryResponses = await this.generateCategoryResponses(
          classification.categories as ChatCategory[],
          athleteId,
          date,
          promptWithLanguage,
          athlete
        )
        const militaryContext = await this.getMilitaryProtocolContext(prompt)

        // Use orchestrator to summarize responses
        const responderPieces = categoryResponses.map((result) => ({
          name: `${result.category}_response`,
          content: result.response,
        }))
        const piecesFromResponders = [
          ...(militaryContext ? [{ name: 'military_context', content: militaryContext }] : []),
          ...responderPieces,
        ]

        const orchestratorResponse = await this.orchestrator.summarize({
          date: date,
          prompt: promptWithLanguage,
          language: language,
          history,
          pieces: piecesFromResponders,
        })
        // Parse orchestrator response
        const parsedResult = this.parseOrchestratorResponse(orchestratorResponse, language)
        aiResponse = parsedResult.response
        questions = parsedResult.questions
      } catch (error) {
        console.error('Failed to generate response from orchestrator:', error)
        const fallbackMessage = language === 'fr' ? 'Désolé, réessaye' : 'Sorry, Try again'
        aiResponse = fallbackMessage
        questions = []
      }
    }

    return { aiResponse, questions }
  }

  private async getMilitaryProtocolContext(prompt: string): Promise<string | null> {
    try {
      const militaryResult = await this.militaryProtocolService.processQuery(prompt)

      const relevantProtocols = militaryResult.matchedProtocols

      if (relevantProtocols.length === 0) {
        return null
      }

      const protocolText = relevantProtocols
        .map(([protocol, score]) => {
          const confidence = protocol.confidence || 0.5
          return `**${protocol.title}** (Score: ${score.toFixed(2)}, confidence: ${confidence})
Catégorie: ${protocol.category}/${protocol.subcategory}
Instruction: ${protocol.instruction}
${protocol.parameters ? `Paramètres: ${JSON.stringify(protocol.parameters)}` : ''}`
        })
        .join('\n\n')

      const protocolPrompt = await Prompt.findBy('title', 'army_protocol_prompt_chatbot')
      if (!protocolPrompt) {
        throw new Error('Prompt non trouvé')
      }
      const protocolPromptContent = protocolPrompt.content.replace('{protocol_text}', protocolText)

      return protocolPromptContent
    } catch (error) {
      console.error('Error getting military protocol context:', error)
      return null
    }
  }

  private normalizeResponseString(str: string): string {
    if (!str) return str
    return str.replace(/\\n/g, '\n')
  }

  private parseOrchestratorResponse(
    response: string,
    language: string
  ): { response: string; questions: string[] } {
    try {
      const parsedResult = JSON.parse(response)
      return {
        response: this.normalizeResponseString(parsedResult.response || ''),
        questions: parsedResult.questions || [],
      }
    } catch (parseError) {
      console.warn('Initial JSON parse failed, attempting to clean response:', parseError)
      try {
        const cleanedResult = cleanJsonResponse(response)
        const parsedResult = JSON.parse(cleanedResult)
        return {
          response: this.normalizeResponseString(
            parsedResult.response || (language === 'fr' ? 'Désolé, réessaye' : 'Sorry, Try again')
          ),
          questions: parsedResult.questions || [],
        }
      } catch (cleanError) {
        console.error('Failed to parse JSON after cleaning:', cleanError)
        const fallbackMessage = language === 'fr' ? 'Désolé, réessaye' : 'Sorry, Try again'
        return {
          response: fallbackMessage,
          questions: [],
        }
      }
    }
  }

  private async generateDiscussionTitle(prompt: string): Promise<string> {
    const systemPromptRow = await Prompt.findByOrFail(
      'title',
      PLAYER_CHATBOT_PROMPT_TITLES.titleGenerator
    )
    const titlePrompt = `Generate a short, descriptive title (max 50 characters) for this conversation: "${prompt}"`
    try {
      const title = await this.gptService.generateTitle(systemPromptRow.content, titlePrompt)
      return title.substring(0, 50).trim()
    } catch (error) {
      console.error('Error generating title:', error)
      return `Conversation - ${new Date().toLocaleDateString()}`
    }
  }

  public async getAthleteHealthData(athleteData: Athlete): Promise<HealthDataEntry[]> {
    try {
      const healthDataJson = []

      if (!athleteData?.days || !Array.isArray(athleteData.days)) {
        console.warn('[Player Chatbot] Invalid athlete data structure for health data')
        return []
      }

      for (const day of athleteData.days) {
        try {
          if (day?.health) {
            const healthEntry = {
              date: day.dateOfDay?.toFormat('yyyy-MM-dd') || null,
              moodRating: day.health.moodRating || null,
              energyRating: day.health.energyRating || null,
              relaxRating: day.health.stressRating || null,
            }
            healthDataJson.push(healthEntry)
          }
        } catch (dayError) {
          console.error('[Player Chatbot] Error processing day health data:', dayError)
        }
      }

      return healthDataJson
    } catch (error) {
      console.error('[Player Chatbot] Error in getAthleteHealthData:', error)
      return []
    }
  }

  public async getAthleteActivityData(athleteData: Athlete): Promise<ActivityDataEntry[]> {
    if (!athleteData?.days?.length) return []

    const athleteWithZones = await this.athleteService.enrichActivitiesWithZones(athleteData)

    const result: ActivityDataEntry[] = []
    for (const day of athleteWithZones.days || []) {
      if (!day?.sportActivities?.length) continue

      for (const activity of day.sportActivities) {
        const entry: ActivityDataEntry = {
          date: day.dateOfDay?.toFormat('yyyy-MM-dd') || null,
          activityName: activity.activityName || activity.sport?.name || null,
          sportType: activity.sport?.name || null,
          activityDuration: parseSecondsToDuration(activity.durationSeconds),
          activityTrainingLoad: activity.trainingLoad || null,
          activityRpe: activity.rpe || null,
          activityActiveCalories: activity.activeCalories
            ? `${activity.activeCalories} kcal`
            : null,
          activityDistance: activity.distance ? `${activity.distance} km` : null,
          activityAveragePace: activity.speed ? `${activity.speed} min/km` : null,
          activityAverageBpm: activity.averagedBpm ? `${activity.averagedBpm} bpm` : null,
          heartRateZones: activity.zones
            ? `Time in zones: ${parseMicrosecondsToDuration(activity.zones.zone1)} in zone1, ${parseMicrosecondsToDuration(activity.zones.zone2)} in zone2, ${parseMicrosecondsToDuration(activity.zones.zone3)} in zone3, ${parseMicrosecondsToDuration(activity.zones.zone4)} in zone4, ${parseMicrosecondsToDuration(activity.zones.zone5)} in zone5`
            : null,
        }

        const basketballGame = this.extractBasketballGameMetrics(activity as SportActivity)
        if (basketballGame) entry.basketballGame = basketballGame

        result.push(entry)
      }
    }
    return result
  }

  public async getPastSevenDaysSleepData(athleteData: Athlete): Promise<SleepDataEntry[]> {
    try {
      const sleepDataJson = []

      if (!athleteData?.days || !Array.isArray(athleteData.days)) {
        console.warn('[Player Chatbot] Invalid athlete data structure for sleep data')
        return []
      }

      for (const day of athleteData.days) {
        try {
          if (day?.sleeps && Array.isArray(day.sleeps) && day.sleeps.length > 0) {
            const sleep = day.sleeps[0]
            if (sleep) {
              const durationInMicroseconds = sleep.totalInBedTimeMilli
                ? sleep.totalInBedTimeMilli * 1000 -
                  (sleep.napAm ? sleep.napAm : 0) -
                  (sleep.napPm ? sleep.napPm : 0)
                : 0
              const durationText = parseMicrosecondsToDuration(durationInMicroseconds)
              const sleepEntry = {
                date: day.dateOfDay?.toFormat('yyyy-MM-dd') || null,
                qualityRating: sleep.qualityRating || null,
                duration: durationText,
                sleepEfficiencyPercentage: sleep.sleepEfficiencyPercentage || null,
                totalInBedTimeMilli: sleep.totalInBedTimeMilli || null,
                totalAwakeTimeMilli: sleep.totalAwakeTimeMilli || null,
                baselineMili: sleep.baselineMili || null,
                bedtimeDate: sleep.bedtimeDate?.toISO() || null,
                wakeUpDate: sleep.wakeUpDate?.toISO() || null,
              }
              sleepDataJson.push(sleepEntry)
            }
          }
        } catch (dayError) {
          console.error('[Player Chatbot] Error processing day sleep data:', dayError)
        }
      }

      return sleepDataJson.sort((a: SleepDataEntry, b: SleepDataEntry) => {
        const dateA = a.bedtimeDate ? new Date(a.bedtimeDate).getTime() : 0
        const dateB = b.bedtimeDate ? new Date(b.bedtimeDate).getTime() : 0
        return dateB - dateA
      })
    } catch (error) {
      console.error('[Player Chatbot] Error in getPastSevenDaysSleepData:', error)
      return []
    }
  }

  private async getCategoryResponse(opts: {
    systemPromptContent: string
    dataPrompt: string
    prompt: string
    category: string
  }): Promise<string> {
    const { systemPromptContent, dataPrompt, prompt, category } = opts

    const modeIndicator = category === 'general' ? '' : `\n[Mode: ${category}]`

    return this.gptService.generateResponse({
      systemPrompt: `${systemPromptContent}${modeIndicator}`,
      dataPrompt,
      prompt,
      history: [],
    })
  }

  public async generateCategoryResponses(
    classified: ChatCategory[],
    athleteId: string,
    date: string,
    promptWithLanguage: string,
    atheleteData: Athlete
  ): Promise<CategoryResponse[]> {
    const categoryResponses = await Promise.allSettled(
      classified.map(async (category) => {
        try {
          let response = ''

          const systemPrompt = await Prompt.findBy('title', `${category}_expert`)
          if (!systemPrompt) {
            throw new Error(`Prompt non trouvé pour ${category}_expert`)
          }
          const systemPromptContent = systemPrompt.content

          let categoryData = ''
          switch (category) {
            case 'general':
              categoryData = `Voici les données de l'athlète:\n${atheleteData}`
              break
            case 'sleep':
              const sleepData = await this.getPastSevenDaysSleepData(atheleteData)
              categoryData = `Voici les données de sommeil des 7 derniers jours de l'athlète:\n${encode({ sleepData })}`
              break
            case 'nutrition':
              const nutritionData = await this.athleteService.getLastSevenDaysMacros(
                athleteId,
                date
              )
              const skippedMeals = await this.getSkippedMealsForDate(athleteId, date)
              const skippedMealNames = this.nutritionService.getSkippedMealNames(skippedMeals)
              categoryData = `Voici les données de nutrition de l'athlète:\n${encode({
                nutritionData,
                skippedMeals: Object.keys(skippedMeals).length > 0 ? skippedMeals : undefined,
                skippedMealNames: skippedMealNames.length > 0 ? skippedMealNames : undefined,
              })}`
              break
            case 'activity':
              const twentyDaysActivityData = await this.athleteService.getAthleteWithDetails({
                athleteId,
                days: 20,
                startDate: date,
              })
              const activityData = await this.getAthleteActivityData(
                !twentyDaysActivityData ? atheleteData : twentyDaysActivityData
              )
              categoryData = `Today is ${date}. Voici les données d'activité de l'athlète:\n${encode({ activityData })}`
              break
            case 'health':
              const healthData = await this.getAthleteHealthData(atheleteData)
              categoryData = `Voici les données de santé de l'athlète:\n${encode({ healthData })}`
              break
          }

          response = await this.getCategoryResponse({
            systemPromptContent: systemPromptContent,
            dataPrompt: categoryData,
            prompt: promptWithLanguage,
            category,
          })
          return { category, response }
        } catch (error) {
          console.error(`Error generating ${category} response:`, error)
          return { category, response: `Error generating ${category} response` }
        }
      })
    )

    return categoryResponses
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value)
  }

  public async generateFollowUpQuestions(response: string, category: string): Promise<string[]> {
    const systemPromptRow = await Prompt.findByOrFail(
      'title',
      PLAYER_CHATBOT_PROMPT_TITLES.followupGenerator
    )
    const dataPrompt = `Context: This is a follow-up question generation for a player chatbot conversation.`
    const followUpPrompt = `Based on this response: "${response}", generate 3 relevant follow-up questions for a player in the ${category} category. Return as JSON array of strings.`

    try {
      const followUpResponse = await this.gptService.generateResponse({
        systemPrompt: systemPromptRow.content,
        dataPrompt,
        prompt: followUpPrompt,
        history: [],
      })

      const cleanedResponse = cleanJsonResponse(followUpResponse)
      const questions = JSON.parse(cleanedResponse)

      return Array.isArray(questions) ? questions.slice(0, 3) : []
    } catch (error) {
      console.error('Error generating follow-up questions:', error)
      return []
    }
  }
}
