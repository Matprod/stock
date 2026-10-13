import type { HttpContext } from '@adonisjs/core/http'
import AthleteService from '#services/athlete_service'
import { WahooService } from '#services/wahoo_service'
import { wahooTokenQuerySchema } from '#schemas/mobile/wahoo'
import SyncWahooWorkoutsJob from '#jobs/sync_wahoo_workouts_job'

export default class WahooOauthController {
  private readonly athleteService: AthleteService
  private readonly wahooService: WahooService

  constructor() {
    this.athleteService = new AthleteService()
    this.wahooService = new WahooService()
  }

  public async authorize({ response }: HttpContext) {
    try {
      const authorization_url = this.wahooService.buildAuthorizationUrl()

      return response.json({ authorization_url })
    } catch (e) {
      console.error('WahooOauthController.authorize error', e)
      return response.internalServerError({
        message: e instanceof Error ? e.message : 'An error occurred.',
      })
    }
  }

  /**
   * Public OAuth callback for local dev — displays the authorization code in the browser.
   * Set WAHOO_REDIRECT_URI=http://localhost:3333/wahoo/callback
   */
  public async callback({ request, response }: HttpContext) {
    const code = request.input('code')
    const error = request.input('error')
    const errorDescription = request.input('error_description')

    if (error) {
      return response
        .status(400)
        .header('Content-Type', 'text/html; charset=utf-8')
        .send(
          `<html><body style="font-family:sans-serif;padding:2rem"><h1>Wahoo OAuth error</h1><p><strong>${error}</strong></p><p>${errorDescription ?? ''}</p></body></html>`
        )
    }

    if (!code) {
      return response
        .status(400)
        .header('Content-Type', 'text/html; charset=utf-8')
        .send(
          '<html><body style="font-family:sans-serif;padding:2rem"><h1>No code received</h1><p>Check that the redirect URI matches exactly in the Wahoo developer portal and in .env</p></body></html>'
        )
    }

    const tokenUrl = `http://localhost:3333/mobile/wahoo/token?code=${encodeURIComponent(code)}`

    return response.header('Content-Type', 'text/html; charset=utf-8').send(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Wahoo OAuth</title></head>
<body style="font-family:sans-serif;padding:2rem;max-width:720px">
  <h1>Code Wahoo reçu</h1>
  <p>Copie ce code (valide ~10 min) :</p>
  <pre id="code" style="background:#f4f4f4;padding:1rem;overflow:auto">${code}</pre>
  <button onclick="navigator.clipboard.writeText(document.getElementById('code').innerText)">Copier</button>
  <h2>Ensuite</h2>
  <p>Appelle l'endpoint token avec ton JWT mobile :</p>
  <pre style="background:#f4f4f4;padding:1rem;overflow:auto">GET ${tokenUrl}
Authorization: Bearer &lt;ton_jwt_mobile&gt;</pre>
</body>
</html>`)
  }

  public async token({ request, response, athlete }: HttpContext) {
    try {
      const { code } = await wahooTokenQuerySchema.validate(request.qs())

      const athleteRecord = await this.athleteService.getAthleteById(athlete!.athleteid)
      if (!athleteRecord) return response.notFound({ message: 'Athlete not found' })

      const tokens = await this.wahooService.exchangeCodeForTokens(code)
      const wahooUser = await this.wahooService.getAuthenticatedUser(tokens.access_token)

      const provider = await this.wahooService.upsertProviderForAthlete(
        athleteRecord.id,
        tokens,
        wahooUser
      )

      try {
        await SyncWahooWorkoutsJob.dispatch({ athleteId: athleteRecord.id })
      } catch (e) {
        console.error('Wahoo historical sync dispatch failed (non-blocking)', e)
      }

      return response.json({
        wahoo_user_id: wahooUser.id,
        provider_id: provider.id,
        historical_sync: 'queued',
      })
    } catch (e) {
      console.error('WahooOauthController.token error', e)
      return response.internalServerError({
        message: e instanceof Error ? e.message : 'An error occurred.',
      })
    }
  }

  public async disconnect({ response, athlete }: HttpContext) {
    try {
      const athleteRecord = await this.athleteService.getAthleteById(athlete!.athleteid)
      if (!athleteRecord) return response.notFound({ message: 'Athlete not found' })

      const provider = await this.wahooService.getProviderForAthlete(athleteRecord.id)

      if (provider?.accessToken) {
        try {
          await this.wahooService.deauthorize(provider)
        } catch (e) {
          console.error('Wahoo deauthorize failed (non-blocking)', e)
        }
      }

      if (provider) {
        await provider.delete()
      }

      return response.json({ message: 'Wahoo disconnected successfully' })
    } catch (e) {
      console.error('WahooOauthController.disconnect error', e)
      return response.internalServerError({
        message: e instanceof Error ? e.message : 'An error occurred.',
      })
    }
  }
}
