import type { HttpContext } from '@adonisjs/core/http'
import Athlete from '#models_pg/athlete'
import { schema, validator } from '@adonisjs/validator'

export default class MobileController {
  async registerDevice({ request, response, auth }: HttpContext) {
    const payloadSchema = schema.create({
      registrationToken: schema.string(),
      deviceId: schema.string.optional(),
      deviceType: schema.string.optional(),
    })

    const { registrationToken } = await validator.validate({
      schema: payloadSchema,
      data: request.body(),
    })

    const user = auth.user
    if (!user) {
      return response.unauthorized({ message: 'Unauthorized' })
    }

    const athlete = await Athlete.query().where('id', user.id).first()
    if (!athlete) {
      return response.notFound({ message: 'Athlete not found' })
    }

    athlete.fcmDeviceToken = registrationToken
    await athlete.save()

    return response.ok({ message: 'Device registered successfully.' })
  }
}
