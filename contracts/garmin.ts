export interface GarminActivity {
  userId: string
  summaryId: string
  activityId: string
  summary: GarminActivitySummary
  samples: GarminActivitySample[]
}

export interface GarminActivitySummary {
  activityId: string
  activityName: string
  durationInSeconds: number
  startTimeInSeconds: number
  startTimeOffsetInSeconds: number
  activityType: string
  averageHeartRateInBeatsPerMinute: number
  averageRunCadenceInStepsPerMinute?: number
  averageSpeedInMetersPerSecond?: number
  averagePaceInMinutesPerKilometer?: number
  activeKilocalories: number
  deviceName: string
  distanceInMeters?: number
  averageBikeCadenceInRoundsPerMinute?: number
  averagePushCadenceInPushesPerMinute?: number
  averageSwimCadenceInStrokesPerMinute?: number
  maxBikeCadenceInRoundsPerMinute?: number
  maxHeartRateInBeatsPerMinute: number
  maxPaceInMinutesPerKilometer?: number
  maxPushCadenceInPushesPerMinute?: number
  maxRunCadenceInStepsPerMinute?: number
  maxSpeedInMetersPerSecond?: number
  numberOfActiveLengths?: number
  startingLatitudeInDegree?: number
  startingLongitudeInDegree?: number
  steps?: number
  pushes?: number
  totalElevationGainInMeters?: number
  totalElevationLossInMeters?: number
  isWebUpload: boolean
}

export interface GarminActivitySample {
  startTimeInSeconds: number
  latitudeInDegree?: number
  longitudeInDegree?: number
  elevationInMeters?: number
  airTemperatureCelcius?: number
  heartRate?: number
  speedMetersPerSecond?: number
  stepsPerMinute?: number
  totalDistanceInMeters?: number
  powerInWatts?: number
  bikeCadenceInRPM?: number
  swimCadenceInStrokesPerMinute?: number
  wheelChairCadenceInPushesPerMinute?: number
  timerDurationInSeconds: number
  clockDurationInSeconds: number
  movingDurationInSeconds: number
}

export interface GarminAthlete {
  garminUserId: string
  athleteId: string
}

export interface GarminSleep {
  userId: string
  summaryId: string
  calendarDate: string
  durationInSeconds: number
  totalNapDurationInSeconds?: number
  startTimeInSeconds: number
  startTimeOffsetInSeconds: number
  unmeasurableSleepInSeconds?: number
  deepSleepDurationInSeconds?: number
  lightSleepDurationInSeconds?: number
  remSleepInSeconds?: number
  awakeDurationInSeconds?: number
  sleepLevelsMap?: Record<string, unknown>
  timeOffsetSleepSpo2?: Record<string, unknown>
  timeOffsetSleepRespiration?: Record<string, unknown>
}

export interface GpsData {
  timestamp: string
  latitude: number
  longitude: number
}
