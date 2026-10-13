import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import type { IChartSpec } from '#contracts/chatbot'

export default class DemoPair extends BaseModel {
  static table = 'demo_pairs'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare question: string

  @column()
  declare answer: string

  @column()
  declare category: 'performance' | 'injury' | null

  @column.date()
  declare referenceDate: DateTime | null

  @column()
  declare isActive: boolean

  @column({
    consume: (v) => (typeof v === 'string' ? JSON.parse(v) as number[] : v),
    prepare: (v) => (v ? JSON.stringify(v) : null),
  })
  declare embedding: number[] | null

  @column({
    consume: (v) => (typeof v === 'string' ? JSON.parse(v) as string[] : v),
    prepare: (v) => (v ? JSON.stringify(v) : null),
  })
  declare variants: string[] | null

  @column({
    consume: (v) => (typeof v === 'string' ? JSON.parse(v) as number[][] : v),
    prepare: (v) => (v ? JSON.stringify(v) : null),
  })
  declare variantEmbeddings: number[][] | null

  @column({
    consume: (v) => (typeof v === 'string' ? JSON.parse(v) as IChartSpec : v),
    prepare: (v) => (v ? JSON.stringify(v) : null),
  })
  declare chartData: IChartSpec | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
