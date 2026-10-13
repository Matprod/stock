import { BaseSeeder } from '@adonisjs/lucid/seeders'
import User from '#models_pg/user'
import { USER_ROLE } from '#constants/user.constants'
import Club from '#models_pg/club'

export default class extends BaseSeeder {
  async run() {
    const club = await Club.findByOrFail('name', 'AC Mauna')

    await User.create({
      email: 'axel@mauna-ai.com',
      password: 'Admin123.',
      role: USER_ROLE.SUPER_ADMIN,
      clubId: club.id,
    })
  }
}
