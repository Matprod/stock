import axios from 'axios';
import env from '#start/env';
export default class FeatureImportanceService {
    featureImportanceBaseUrl = env.get('MACHINE_LEARNING_FEATURE_IMPORTANCE_URL');
    async calculateFeatureImportance(payload) {
        const token = env.get('MACHINE_LEARNING_API_TOKEN');
        try {
            const response = await axios.post(this.featureImportanceBaseUrl, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
            });
            return response.data;
        }
        catch (error) {
            console.error('Error calculating feature importance:', error);
            throw error;
        }
    }
}
//# sourceMappingURL=feature_importance_service.js.map