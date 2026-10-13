import env from '#start/env';
import axios from 'axios';
export const BREVO_TEMPLATES = {
    WELCOME: 31,
    FORGOT_PASSWORD: 32,
};
export default class BrevoService {
    apiKey;
    constructor() {
        this.apiKey = env.get('BREVO_API_KEY');
    }
    async sendEmail(to, templateId, params) {
        await axios.post('https://api.brevo.com/v3/smtp/email', {
            to: [{ email: to }],
            templateId: BREVO_TEMPLATES[templateId],
            params,
        }, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'api-key': this.apiKey,
            },
        });
    }
}
//# sourceMappingURL=brevo_service.js.map