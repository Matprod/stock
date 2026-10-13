import type { HttpContext } from '@adonisjs/core/http'
import AthleteService from '#services/athlete_service'
import { WhoopService } from '#services/whoop_service'
import { whoopTokenQuerySchema } from '#schemas/mobile/whoop'

export default class WhoopOauthController {
  private readonly athleteService: AthleteService
  private readonly whoopService: WhoopService

  constructor() {
    this.athleteService = new AthleteService()
    this.whoopService = new WhoopService()
  }

  public async authorize({ response }: HttpContext) {
    try {
      const authorization_url = this.whoopService.buildAuthorizationUrl()

      return response.json({ authorization_url })
    } catch (e) {
      console.error('WhoopOauthController.authorize error', e)
      return response.internalServerError({
        message: e instanceof Error ? e.message : 'An error occurred.',
      })
    }
  }

  public async callback({ request, response }: HttpContext) {
    const code = request.input('code')
    const error = request.input('error')
    const errorDescription = request.input('error_description')

    if (error) {
      return response
        .status(400)
        .header('Content-Type', 'text/html; charset=utf-8')
        .send(
          `<html><body style="font-family:sans-serif;padding:2rem"><h1>Whoop OAuth error</h1><p><strong>${error}</strong></p><p>${errorDescription ?? ''}</p></body></html>`
        )
    }

    if (!code) {
      return response
        .status(400)
        .header('Content-Type', 'text/html; charset=utf-8')
        .send(
          '<html><body style="font-family:sans-serif;padding:2rem"><h1>No code received</h1><p>Check that the redirect URI matches exactly in the Whoop Developer Dashboard and in .env</p></body></html>'
        )
    }

    const tokenUrl = `http://localhost:3333/mobile/whoop/token?code=${encodeURIComponent(code)}`

    return response.header('Content-Type', 'text/html; charset=utf-8').send(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Whoop OAuth</title></head>
<body style="font-family:sans-serif;padding:2rem;max-width:720px">
  <h1>Code Whoop reçu</h1>
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
      const { code } = await whoopTokenQuerySchema.validate(request.qs())

      const athleteRecord = await this.athleteService.getAthleteById(athlete!.athleteid)
      if (!athleteRecord) return response.notFound({ message: 'Athlete not found' })

      const tokens = await this.whoopService.exchangeCodeForTokens(code)
      const whoopUser = await this.whoopService.getAuthenticatedUser(tokens.access_token)

      const provider = await this.whoopService.upsertProviderForAthlete(
        athleteRecord.id,
        tokens,
        whoopUser
      )

      return response.json({
        whoop_user_id: whoopUser.user_id,
        provider_id: provider.id,
      })
    } catch (e) {
      console.error('WhoopOauthController.token error', e)
      return response.internalServerError({
        message: e instanceof Error ? e.message : 'An error occurred.',
      })
    }
  }

  public async disconnect({ response, athlete }: HttpContext) {
    try {
      const athleteRecord = await this.athleteService.getAthleteById(athlete!.athleteid)
      if (!athleteRecord) return response.notFound({ message: 'Athlete not found' })

      const provider = await this.whoopService.getProviderForAthlete(athleteRecord.id)

      if (provider?.accessToken) {
        try {
          await this.whoopService.deauthorize(provider)
        } catch (e) {
          console.error('Whoop deauthorize failed (non-blocking)', e)
        }
      }

      if (provider) {
        await provider.delete()
      }

      return response.json({ message: 'Whoop disconnected successfully' })
    } catch (e) {
      console.error('WhoopOauthController.disconnect error', e)
      return response.internalServerError({
        message: e instanceof Error ? e.message : 'An error occurred.',
      })
    }
  }
}
