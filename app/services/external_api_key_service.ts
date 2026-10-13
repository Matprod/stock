import { createHash, randomBytes } from 'node:crypto'
import { DateTime } from 'luxon'
import Club from '#models_pg/club'
import ClubApiKey from '#models_pg/club_api_key'
import {
  EXTERNAL_API_KEY_PREFIX,
  EXTERNAL_API_KEY_PREFIX_VISIBLE_CHARS,
  EXTERNAL_API_LAST_USED_TOUCH_SECONDS,
} from '#constants/external_api.constants'

const hashApiKey = (plaintext: string) => {
  return createHash('sha256').update(plaintext).digest('hex')
}

export default class ExternalApiKeyService {
  async create({ clubId, name }: { clubId: string; name: string }) {
    await Club.findOrFail(clubId)

    const plaintext = `${EXTERNAL_API_KEY_PREFIX}${randomBytes(32).toString('base64url')}`
    const apiKey = await ClubApiKey.create({
      clubId,
      name,
      keyPrefix: plaintext.slice(
        0,
        EXTERNAL_API_KEY_PREFIX.length + EXTERNAL_API_KEY_PREFIX_VISIBLE_CHARS
      ),
      keyHash: hashApiKey(plaintext),
    })

    return { apiKey, plaintext }
  }

  async authenticate(plaintext: string) {
    return ClubApiKey.query().where('keyHash', hashApiKey(plaintext)).whereNull('revokedAt').first()
  }

  async listByClub(clubId: string) {
    return ClubApiKey.query().where('clubId', clubId).orderBy('createdAt', 'desc')
  }

  async revoke(id: string) {
    const apiKey = await ClubApiKey.findOrFail(id)
    if (apiKey.revokedAt) {
      return apiKey
    }

    apiKey.revokedAt = DateTime.now()
    await apiKey.save()
    return apiKey
  }

  async touchLastUsed(apiKey: ClubApiKey) {
    const shouldTouch =
      !apiKey.lastUsedAt ||
      DateTime.now().diff(apiKey.lastUsedAt, 'seconds').seconds >=
        EXTERNAL_API_LAST_USED_TOUCH_SECONDS

    if (!shouldTouch) {
      return
    }

    apiKey.lastUsedAt = DateTime.now()
    await apiKey.save()
  }
}
