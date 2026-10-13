import { TrainMyAthleteInjuryOccurredIn } from '#contracts/train_my_athlete'
import Injury from '#models_pg/injury'

export const TRAIN_MY_ATHLETE_OCCURRED_IN_TO_CONTEXT: Record<
  TrainMyAthleteInjuryOccurredIn,
  Injury['context']
> = {
  competition: 'match',
  training: 'training',
  other: 'other',
} as const
