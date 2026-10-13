import { TypeSafeClient, choice, noul } from '@typesafe-ai/sdk'
import env from '#start/env'

export { TypeSafeClient, choice, noul }

let client: TypeSafeClient | undefined

export default class JevService {
  static getClient(): TypeSafeClient | undefined {
    const apiKey = env.get('TYPESAFE_API_KEY')
    if (!apiKey) return undefined
    client ??= new TypeSafeClient({ apiKey })
    return client
  }

  static requireClient(): TypeSafeClient {
    const resolved = JevService.getClient()
    if (!resolved) throw new Error('TYPESAFE_API_KEY missing')
    return resolved
  }

  static isAvailable(): boolean {
    return Boolean(env.get('TYPESAFE_API_KEY'))
  }
}
