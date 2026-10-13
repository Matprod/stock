export interface MyCoachClub {
  id: string
  name: string
  additionalIds: string[]
}

export interface MyCoachTeam {
  id: string
  name: string
  additionalIds: string[]
  club: MyCoachClub | null
}

export interface MyCoachPlayer {
  id: string
  playerId: string
  firstName: string
  lastName: string
  gender: string
  dateOfBirth: string
  placeOfBirth: string
  citizenship: string
  additionalCitizenShips: string[] | null
  weight: number
  height: number
  additionalIds: string[]
  endOfContract: string | null
  team: MyCoachTeam | null
  position: {
    id: string
    name: string
  }
  strongFoot: string | null
  shirtNumber: number | null
  currentStatus: string | null
  nickname: string | null
}

export interface MyCoachVariableCategory {
  id: string
  name: string
  type: string
}

export interface MyCoachQuestion {
  id: string
  text: string
  type: string
}

export interface MyCoachVariable {
  id: string
  variableCategoryId: string
  playerId: string
  value: number
  question: MyCoachQuestion | null
  authorId: string
}

export interface MyCoachTextVariable {
  id: string
  text: string
  variableCategoryId: string
  playerId: string
}

export interface MyCoachPeriod {
  id: string
  startDate: string
  endDate: string
  label: string
}

export interface MyCoachScoutingEventInformation {
  id: string
  opponent: string
  location: string
  competition: string
}

export interface MyCoachTrainingInformation {
  tags: string[]
  intensity: number | null
  focus: string | null
}

export interface MyCoachQuestionnaire {
  id: string
  name: string
  questions: MyCoachQuestion[]
}

export interface MyCoachEvent {
  id: string
  teamId: string
  label: string
  startDate: string
  endDate: string
  eventType: string
  variables: MyCoachVariable[]
  textVariables: MyCoachTextVariable[]
  periods: MyCoachPeriod[]
  scoutingEventInformation: MyCoachScoutingEventInformation | null
  trainingInformation: MyCoachTrainingInformation
  parent: MyCoachEvent | null
  deletedAt: string | null
  questionnaire: MyCoachQuestionnaire | null
}

export interface MyCoachConnector {
  id: string
  type: string
  sourceId: string
  targetId: string
}

export interface MyCoachQuestionnaireInformation {
  id: string
  name: string
  description: string | null
}

export interface MyCoachVariableAuthor {
  id: string
  name: string
  type: string
}

export interface MyCoachResponse {
  teams: MyCoachTeam[]
  players: MyCoachPlayer[]
  variableCategories: MyCoachVariableCategory[]
  events: MyCoachEvent[]
  connectors: MyCoachConnector[]
  questionnaireInformation: MyCoachQuestionnaireInformation
  variableAuthors: MyCoachVariableAuthor[]
}

export interface MyCoachUpdateData {
  day_id: string
  data_source: string
  time_of_activity?: string
  duration?: number
  event_type?: string
  game_activity?: number
  activity_type_id?: number | null
  [key: string]: string | number | null | undefined
} 