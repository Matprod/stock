import axios from 'axios'
import type { FeatureImportancePayload, FeatureImportanceResponse } from '#contracts/sunderland'
import env from '#start/env'

export default class FeatureImportanceService {
  private readonly featureImportanceBaseUrl = env.get('MACHINE_LEARNING_FEATURE_IMPORTANCE_URL')

  public async calculateFeatureImportance(
    payload: FeatureImportancePayload
  ): Promise<FeatureImportanceResponse> {
    const token = env.get('MACHINE_LEARNING_API_TOKEN')

    try {
      const response = await axios.post<FeatureImportanceResponse>(
        this.featureImportanceBaseUrl,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        }
      )

      return response.data
    } catch (error) {
      console.error('Error calculating feature importance:', error)
      throw error
    }
  }
}
