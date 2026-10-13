import admin from '#start/firebase'
import Athlete from '#models_pg/athlete'
import Notification from '#models_pg/notification'
import { TRANSLATABLE_TYPES } from '#constants/translation.constants'
import { TRANSLATION_KEYS } from '#constants/translation.constants'
import { TranslationService } from '#services/translation_service'
import NotificationMessage from '#models_pg/notification_message'
import { APP_LANGUAGES } from '#utils/localize'

export class NotificationService {
  private readonly translationService: TranslationService

  constructor() {
    this.translationService = new TranslationService()
  }
  async sendToToken(token: string, title: string, body: string) {
    const message = {
      notification: {
        title,
        body,
      },
      token,
    }

    try {
      const response = await admin.messaging().send(message)
      console.log('Notification envoyée :', response)
      return response
    } catch (error) {
      console.error('Erreur d’envoi :', error)
      throw error
    }
  }

  async sendToMany(tokens: string[], title: string, body: string) {
    const message = {
      notification: { title, body },
      tokens,
    }
    await admin.messaging().sendEachForMulticast(message)
  }

  public async getScheduledNotifications(
    currentTimeFrench: string,
    currentDay: string,
    currentDate: string
  ) {
    return Notification.query()
      .where('time', currentTimeFrench)
      .where((query) => {
        query.where('day', currentDay).orWhere('date', currentDate)
      })
      .preload('athletes')
      .preload('messages')
      .preload('club')
  }

  async buildNotificationMessages(notifications: Notification[]) {
    const notificationMessagesToSend: Array<Parameters<typeof this.sendToMany>> = []

    for (const notification of notifications) {
      const athletes = await this.getAthletesForNotification(notification)

      if (athletes.length === 0 || notification.messages.length === 0) {
        console.log('No athletes or messages found for notification', notification.id)
        continue
      }

      const randomMessage =
        notification.messages[Math.floor(Math.random() * notification.messages.length)]
      const translations = await this.getTranslationsForMessage(randomMessage)
      const athleteTokens = this.groupAthletesByLanguage(athletes)

      if (athleteTokens.frenchTokens.length > 0) {
        console.log('Sending French notification to', athleteTokens.frenchTokens.length, 'tokens')
        notificationMessagesToSend.push([
          athleteTokens.frenchTokens,
          translations.french.title || randomMessage.title,
          translations.french.content || randomMessage.content,
        ])
      }

      if (athleteTokens.englishTokens.length > 0) {
        console.log('Sending English notification to', athleteTokens.englishTokens.length, 'tokens')
        notificationMessagesToSend.push([
          athleteTokens.englishTokens,
          translations.english.title || randomMessage.title,
          translations.english.content || randomMessage.content,
        ])
      }
    }

    return notificationMessagesToSend
  }

  async getAthletesForNotification(
    notification: Notification
  ): Promise<Array<Pick<Athlete, 'fcmDeviceToken' | 'id' | 'appLanguage'>>> {
    const clubId = notification.clubId ?? undefined
    const athleteIds = notification.athletes
      ? notification.athletes.map((athlete) => athlete.id)
      : []

    let query = Athlete.query().whereNotNull('fcmDeviceToken')

    if (athleteIds.length > 0) {
      query = query.whereIn('id', athleteIds)
    }

    if (clubId) {
      query = query.where('clubId', clubId)
    }

    const athletes = await query

    return athletes
      .map((athlete) => ({
        id: athlete.id,
        fcmDeviceToken: athlete.fcmDeviceToken,
        appLanguage: athlete.appLanguage,
      }))
      .filter((athlete) => athlete.fcmDeviceToken)
  }

  private async getTranslationsForMessage(message: NotificationMessage) {
    const [frenchTitle, frenchContent, englishTitle, englishContent] = await Promise.all([
      this.translationService.getTranslations(
        TRANSLATABLE_TYPES.NOTIFICATION_MESSAGE,
        TRANSLATION_KEYS.NOTIFICATION_MESSAGE_TITLE,
        [message.id],
        APP_LANGUAGES.FR
      ),
      this.translationService.getTranslations(
        TRANSLATABLE_TYPES.NOTIFICATION_MESSAGE,
        TRANSLATION_KEYS.NOTIFICATION_MESSAGE_CONTENT,
        [message.id],
        APP_LANGUAGES.FR
      ),
      this.translationService.getTranslations(
        TRANSLATABLE_TYPES.NOTIFICATION_MESSAGE,
        TRANSLATION_KEYS.NOTIFICATION_MESSAGE_TITLE,
        [message.id],
        APP_LANGUAGES.EN
      ),
      this.translationService.getTranslations(
        TRANSLATABLE_TYPES.NOTIFICATION_MESSAGE,
        TRANSLATION_KEYS.NOTIFICATION_MESSAGE_CONTENT,
        [message.id],
        APP_LANGUAGES.EN
      ),
    ])

    const { id } = message
    return {
      french: { title: frenchTitle.get(id), content: frenchContent.get(id) },
      english: { title: englishTitle.get(id), content: englishContent.get(id) },
    }
  }

  private groupAthletesByLanguage(
    athletes: Array<Pick<Athlete, 'fcmDeviceToken' | 'appLanguage'>>
  ) {
    const frenchTokens = athletes
      .filter((athlete) => athlete.fcmDeviceToken !== null && athlete.appLanguage === 'fr')
      .map((athlete) => athlete.fcmDeviceToken!)

    const englishTokens = athletes
      .filter(
        (athlete) =>
          (athlete.fcmDeviceToken !== null && athlete.appLanguage === 'en') ||
          athlete.appLanguage === null
      )
      .map((athlete) => athlete.fcmDeviceToken!)

    return { frenchTokens, englishTokens }
  }

  async sendNotificationMessages(
    notificationMessagesToSend: Array<Parameters<typeof this.sendToMany>>
  ) {
    return Promise.allSettled(
      notificationMessagesToSend.map(([tokens, title, body]) => {
        return this.sendToMany(tokens, title, body)
      })
    )
  }
}
