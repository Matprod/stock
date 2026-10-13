import { LucidRow, ModelAttributes } from '@adonisjs/lucid/types/model'

export type InputAttributes<M extends LucidRow> = Omit<
  ModelAttributes<M>,
  'id' | 'createdAt' | 'updatedAt'
>
