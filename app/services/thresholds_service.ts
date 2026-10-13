import ClubSetting from '#models_pg/club_settings'
import type { ThresholdLevel, ThresholdsPayload, ThresholdsResponse } from '#contracts/thresholds'

const FALLBACK_THRESHOLDS: ThresholdsPayload = {
  performance: { high: 70, medium: 40 },
  injury: { high: 20, medium: 10 },
  availability: { high: 70, medium: 40 },
}

export default class ThresholdsService {
  static getThresholdLevelValidationError(level: ThresholdLevel, label: string): string | null {
    if (level.medium < 0 || level.medium > 100 || level.high < 0 || level.high > 100) {
      return `${label} thresholds must be between 0 and 100`
    }

    if (level.medium >= level.high) {
      return `${label} medium threshold must be strictly lower than high threshold`
    }

    return null
  }

  static getThresholdsPayloadValidationError(payload: ThresholdsPayload): string | null {
    const checks: Array<{ level: ThresholdLevel; label: string }> = [
      { level: payload.performance, label: 'Performance' },
      { level: payload.injury, label: 'Injury' },
      { level: payload.availability, label: 'Availability' },
    ]

    for (const check of checks) {
      const error = this.getThresholdLevelValidationError(check.level, check.label)
      if (error) return error
    }

    return null
  }

  private mapThresholdRow(row: ClubSetting): ThresholdsPayload {
    return {
      performance: {
        high: row.performanceHigh,
        medium: row.performanceMedium,
      },
      injury: {
        high: row.injuryHigh,
        medium: row.injuryMedium,
      },
      availability: {
        high: row.availabilityHigh,
        medium: row.availabilityMedium,
      },
    }
  }

  async getThresholdsByClubId(clubId: string | null): Promise<ThresholdsResponse> {
    const fallbackResponse: ThresholdsResponse = {
      clubId,
      thresholds: FALLBACK_THRESHOLDS,
    }

    if (clubId === null) {
      return fallbackResponse
    }

    const thresholdCandidate = await ClubSetting.query().where('club_id', clubId).first()

    if (thresholdCandidate) {
      return {
        clubId,
        thresholds: this.mapThresholdRow(thresholdCandidate),
      }
    }

    return fallbackResponse
  }
}
