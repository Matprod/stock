import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { GarminActivity, GarminSleep } from '#contracts/garmin'
import ProcessGarminJob from '#jobs/process_garmin_job'
import ProcessGarminSleepJob from '#jobs/process_garmin_sleep_job'
import ProcessWahooWorkoutJob from '#jobs/process_wahoo_workout_job'
import ProcessWhoopWebhookJob from '#jobs/process_whoop_webhook_job'
import type { WahooWorkoutSummaryWebhook } from '#contracts/wahoo'
import type { WhoopWebhookPayload } from '#contracts/whoop'

@inject()
export default class WebhooksController {
  async processGarminActivityDetails(ctx: HttpContext) {
    try {
      const receivedData = ctx.request.body()?.activityDetails || []

      await ProcessGarminJob.dispatch(receivedData as GarminActivity[])

      return ctx.response.status(202).send({
        message: 'Webhook data received and queued for processing',
      })
    } catch (error) {
      console.error('Error processing Garmin webhook:', error)

      return ctx.response.status(400).send({
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      })
    }
  }

  async processGarminSleeps(ctx: HttpContext) {
    try {
      const receivedData = ctx.request.body()?.sleeps || []

      if (!Array.isArray(receivedData) || receivedData.length === 0) {
        return ctx.response.status(400).send({ message: 'No sleep data received' })
      }

      await ProcessGarminSleepJob.dispatch(receivedData as GarminSleep[])

      return ctx.response.status(202).send({
        message: 'Sleep webhook data received and queued for processing',
      })
    } catch (error) {
      console.error('Error processing Garmin sleep webhook:', error)

      return ctx.response.status(400).send({
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      })
    }
  }

  async processWahooWorkoutSummary(ctx: HttpContext) {
    try {
      const receivedData = ctx.request.body() as WahooWorkoutSummaryWebhook

      if (receivedData.event_type !== 'workout_summary') {
        return ctx.response.status(400).send({ message: 'Unsupported Wahoo webhook event type' })
      }

      await ProcessWahooWorkoutJob.dispatch(receivedData)

      return ctx.response.status(200).send({
        message: 'Webhook data received and queued for processing',
      })
    } catch (error) {
      console.error('Error processing Wahoo webhook:', error)

      return ctx.response.status(400).send({
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      })
    }
  }

  async processWhoopWebhook(ctx: HttpContext) {
    try {
      const payload = ctx.request.body() as WhoopWebhookPayload

      if (!payload?.type || !payload?.user_id || !payload?.id) {
        return ctx.response.status(400).send({ message: 'Missing required fields' })
      }

      await ProcessWhoopWebhookJob.dispatch(payload)

      return ctx.response.status(200).send({
        message: 'Webhook data received and queued for processing',
      })
    } catch (error) {
      console.error('Error processing Whoop webhook:', error)

      return ctx.response.status(400).send({
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      })
    }
  }
}
