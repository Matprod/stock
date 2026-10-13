import type { QueryClientContract, TransactionClientContract } from '@adonisjs/lucid/types/database'

export type DbConnection = QueryClientContract | TransactionClientContract
