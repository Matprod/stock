export interface ITrainingLoad {
  calculateExternalTrainingLoad(): number
}

import SportActivity from '#models_pg/sport_activity'

export abstract class BaseTrainingLoad {
  protected sportActivity: SportActivity

  constructor(sportActivity: SportActivity) {
    this.sportActivity = sportActivity
  }

  abstract calculateExternalTrainingLoad(): number
}
