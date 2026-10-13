import { ensureLegacyIdColumn } from '#services/migration/legacy_id'
import { LegacyResolver } from '#services/migration/legacy_resolver'
import type { BilingualNames } from '#services/migration/bilingual'
import { splitBilingualName } from '#services/migration/bilingual'
import {
  insertEntityTranslations,
  type TranslationRow,
} from '#services/migration/entity_translations'
import type { DbConnection } from '#services/migration/types'
import type { TranslatableType, TranslationKey } from '#constants/translation.constants'

export type MigrationResult = {
  table: string
  total: number
  inserted: number
  skipped: number
  rejected: number
}

export type MigratorFn = (
  mysql: DbConnection,
  pg: DbConnection,
  dryRun: boolean
) => Promise<MigrationResult>

export type RowMapper = (
  row: Record<string, unknown>,
  resolve: LegacyResolver
) => Promise<Record<string, unknown> | null> | Record<string, unknown> | null

export type TableMigrationDef = {
  name: string
  mysqlTable: string
  pgTable: string
  batchSize?: number
  orderBy?: { column: string; direction?: 'asc' | 'desc' }
  conflictColumns?: string[]
  mapRow: RowMapper
}

export type BilingualRowMapper = (
  row: Record<string, unknown>,
  bilingual: BilingualNames,
  resolve: LegacyResolver
) => Promise<Record<string, unknown> | null> | Record<string, unknown> | null

export type BilingualTableMigrationDef = {
  name: string
  mysqlTable: string
  pgTable: string
  batchSize?: number
  orderBy?: { column: string; direction?: 'asc' | 'desc' }
  conflictColumns?: string[]
  translatableType: TranslatableType
  translationKey: TranslationKey
  mapRow: BilingualRowMapper
}

const DEFAULT_BATCH_SIZE = 500
/** Tables with moderate row volume (sport activities, days, …) */
export const LARGE_BATCH = 500
/** High-volume metric / fact tables (millions of rows) */
export const XL_BATCH = 2_000

let batchSizeOverride: number | undefined

export function setMigrationBatchSizeOverride(size: number | undefined) {
  batchSizeOverride = size
}

function resolveBatchSize(def: TableMigrationDef | BilingualTableMigrationDef): number {
  return batchSizeOverride ?? def.batchSize ?? DEFAULT_BATCH_SIZE
}

type OrderBy = { column: string; direction?: 'asc' | 'desc' }

function resolveOrderBy(def: { orderBy?: OrderBy }): OrderBy {
  return def.orderBy ?? { column: 'id', direction: 'asc' }
}

async function fetchMysqlBatch(
  mysql: DbConnection,
  table: string,
  batchSize: number,
  orderBy: OrderBy,
  cursor: number | string | Date | null
): Promise<Record<string, unknown>[]> {
  const direction = orderBy.direction ?? 'asc'
  let query = mysql.from(table).select('*')

  if (cursor !== null) {
    query =
      direction === 'asc'
        ? query.where(orderBy.column, '>', cursor)
        : query.where(orderBy.column, '<', cursor)
  }

  return query.orderBy(orderBy.column, direction).limit(batchSize)
}

export function createMigrator(def: TableMigrationDef): MigratorFn {
  return (mysql, pg, dryRun) => runTableMigration(def, mysql, pg, dryRun)
}

export function createBilingualMigrator(def: BilingualTableMigrationDef): MigratorFn {
  return (mysql, pg, dryRun) => runBilingualTableMigration(def, mysql, pg, dryRun)
}

export async function runBilingualTableMigration(
  def: BilingualTableMigrationDef,
  mysql: DbConnection,
  pg: DbConnection,
  dryRun: boolean
): Promise<MigrationResult> {
  const hasLegacyId = await ensureLegacyIdColumn(pg, def.pgTable, dryRun)
  const resolver = new LegacyResolver(pg)
  const batchSize = resolveBatchSize(def)

  const [{ total }] = await mysql.from(def.mysqlTable).count('* as total')
  const totalCount = Number(total)

  let existingLegacyIds = new Set<number>()
  if (hasLegacyId) {
    const existing = await pg.from(def.pgTable).select('legacy_id').whereNotNull('legacy_id')
    existingLegacyIds = new Set(existing.map((row) => Number(row.legacy_id)))
  }

  let inserted = 0
  let skipped = 0
  let rejected = 0
  const orderBy = resolveOrderBy(def)
  let cursor: number | string | Date | null = null

  while (true) {
    const rows = await fetchMysqlBatch(mysql, def.mysqlTable, batchSize, orderBy, cursor)
    if (rows.length === 0) break

    const toInsert: Record<string, unknown>[] = []
    const translationRows: TranslationRow[] = []

    for (const row of rows) {
      const legacyId = Number(row.id)

      if (existingLegacyIds.has(legacyId)) {
        skipped++
        continue
      }

      const bilingual = splitBilingualName(row)
      if (!bilingual) {
        rejected++
        continue
      }

      const mapped = await def.mapRow(row, bilingual, resolver)
      if (!mapped) {
        rejected++
        continue
      }

      toInsert.push({ ...mapped, name: bilingual.name, legacy_id: legacyId })
      translationRows.push({ legacyId, translation: bilingual.translation })
    }

    // same name same category_id
    const duplicates = toInsert.filter(
      (row, index, self) =>
        self.findIndex((t) => t.name === row.name && t.category_id === row.category_id) !== index
    )

    if (duplicates.length > 0) {
      console.log('Duplicates:', duplicates)
    }

    if (!dryRun && toInsert.length > 0) {
      if (def.conflictColumns && def.conflictColumns.length > 0) {
        await pg
          .knexQuery()
          .table(def.pgTable)
          .insert(toInsert)
          .onConflict(def.conflictColumns)
          .ignore()
      } else {
        await pg.table(def.pgTable).multiInsert(toInsert)
      }
      resolver.invalidate(def.pgTable)
      await insertEntityTranslations(pg, dryRun, translationRows, {
        pgTable: def.pgTable,
        translatableType: def.translatableType,
        translationKey: def.translationKey,
      })
    }

    inserted += toInsert.length
    cursor = rows[rows.length - 1][orderBy.column] as number | string | Date
    if (rows.length < batchSize) break
  }

  return {
    table: def.pgTable,
    total: totalCount,
    inserted,
    skipped,
    rejected,
  }
}

export async function runTableMigration(
  def: TableMigrationDef,
  mysql: DbConnection,
  pg: DbConnection,
  dryRun: boolean
): Promise<MigrationResult> {
  const hasLegacyId = await ensureLegacyIdColumn(pg, def.pgTable, dryRun)
  const resolver = new LegacyResolver(pg)
  const batchSize = resolveBatchSize(def)

  const [{ total }] = await mysql.from(def.mysqlTable).count('* as total')
  const totalCount = Number(total)

  let existingLegacyIds = new Set<number>()
  if (hasLegacyId) {
    const existing = await pg.from(def.pgTable).select('legacy_id').whereNotNull('legacy_id')
    existingLegacyIds = new Set(existing.map((row) => Number(row.legacy_id)))
  }

  let inserted = 0
  let skipped = 0
  let rejected = 0
  const orderBy = resolveOrderBy(def)
  let cursor: number | string | Date | null = null

  while (true) {
    const rows = await fetchMysqlBatch(mysql, def.mysqlTable, batchSize, orderBy, cursor)
    if (rows.length === 0) break

    const toInsert: Record<string, unknown>[] = []

    for (const row of rows) {
      const legacyId = Number(row.id)

      if (existingLegacyIds.has(legacyId)) {
        skipped++
        continue
      }

      const mapped = await def.mapRow(row, resolver)
      if (!mapped) {
        rejected++
        continue
      }

      toInsert.push({ ...mapped, legacy_id: legacyId })
    }

    if (!dryRun && toInsert.length > 0) {
      if (def.conflictColumns && def.conflictColumns.length > 0) {
        await pg
          .knexQuery()
          .table(def.pgTable)
          .insert(toInsert)
          .onConflict(def.conflictColumns)
          .ignore()
      } else {
        await pg.table(def.pgTable).multiInsert(toInsert)
      }
      resolver.invalidate(def.pgTable)
    }

    inserted += toInsert.length
    cursor = rows[rows.length - 1][orderBy.column] as number | string | Date
    if (rows.length < batchSize) break
  }

  return {
    table: def.pgTable,
    total: totalCount,
    inserted,
    skipped,
    rejected,
  }
}
