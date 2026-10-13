import env from '#start/env'
import axios from 'axios'

export const BREVO_TEMPLATES = {
  WELCOME: 31,
  FORGOT_PASSWORD: 32,
}

export default class BrevoService {
  private apiKey: string

  constructor() {
    this.apiKey = env.get('BREVO_API_KEY')
  }

  async sendEmail(
    to: string,
    templateId: keyof typeof BREVO_TEMPLATES,
    params: Record<string, string>
  ) {
    await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        to: [{ email: to }],
        templateId: BREVO_TEMPLATES[templateId],
        params,
      },
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'api-key': this.apiKey,
        },
      }
    )
  }
}
