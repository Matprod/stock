import Club from '#models_pg/club'
import { BaseSeeder } from '@adonisjs/lucid/seeders'

export default class extends BaseSeeder {
  async run() {
    await Club.create({
      name: 'AC Mauna',
    })
  }
}
