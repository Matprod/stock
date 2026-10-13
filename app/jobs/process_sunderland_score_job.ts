import { DateTime } from 'luxon'
import { Job } from '@nemoventures/adonis-jobs'
import type { Queues } from '@nemoventures/adonis-jobs/types'
import SunderlandScoreService from '#services/machine_learning/sunderland_score_service'
import { inject } from '@adonisjs/core'

export type ProcessSunderlandScoreData = {
  date: string
  sendSlack?: boolean
  athleteId: string
}

export type ProcessSunderlandScoreReturn = {
  date: string
  athleteId: string
  completed: boolean
}

@inject()
export default class ProcessSunderlandScore extends Job<
  ProcessSunderlandScoreData,
  ProcessSunderlandScoreReturn
> {
  static defaultQueue: keyof Queues = 'sunderland'

  constructor(private sunderlandScoreService: SunderlandScoreService) {
    super()
  }

  async process(): Promise<ProcessSunderlandScoreReturn> {
    const targetDate = DateTime.fromISO(this.data.date).startOf('day')
    if (!targetDate.isValid) {
      throw new Error(`Invalid date for ProcessSunderlandScore: ${this.data.date}`)
    }

    const sendSlack = this.data.sendSlack ?? true
    try {
      await this.sunderlandScoreService.generateScoresForAllAthletes(targetDate, {
        sendSlack,
        athleteId: this.data.athleteId,
      })
    } catch (error) {
      this.fail(error)
    }

    return {
      date: this.data.date,
      athleteId: this.data.athleteId,
      completed: true,
    }
  }
}
