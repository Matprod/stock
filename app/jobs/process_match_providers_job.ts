import { Job } from '@nemoventures/adonis-jobs'
import type { Queues } from '@nemoventures/adonis-jobs/types'
import type { DflClubSyncResult } from '#contracts/dfl'
import type { SkillcornerClubSyncResult } from '#contracts/skillcorner'
import { DflService } from '#services/dfl_service'
import { SkillcornerService } from '#services/skillcorner_service'

export type ProcessMatchProvidersData = {
  from: string
}

export type ProcessMatchProvidersReturn = {
  from: string
  dfl: DflClubSyncResult[]
  skillcorner: SkillcornerClubSyncResult[]
}

export default class ProcessMatchProvidersJob extends Job<
  ProcessMatchProvidersData,
  ProcessMatchProvidersReturn
> {
  static defaultQueue: keyof Queues = 'match_providers'

  async process(): Promise<ProcessMatchProvidersReturn> {
    try {
      this.logger.info('Processing match providers sync (DFL then SkillCorner)', this.data)
      const dfl = await DflService.syncAllClubs(this.data.from)
      const skillcorner = await SkillcornerService.syncAllClubs(this.data.from)
      this.logger.info('Match providers sync finished', {
        from: this.data.from,
        dflClubs: dfl.length,
        skillcornerClubs: skillcorner.length,
      })
      return { from: this.data.from, dfl, skillcorner }
    } catch (error) {
      this.fail(error)
    }
  }
}
