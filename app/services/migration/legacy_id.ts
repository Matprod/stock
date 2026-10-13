import type { DbConnection } from '#services/migration/types'

export async function ensureLegacyIdColumn(
  pg: DbConnection,
  table: string,
  dryRun: boolean
): Promise<boolean> {
  const hasColumn = await pg.schema.hasColumn(table, 'legacy_id')
  if (hasColumn) return true

  if (!dryRun) {
    await pg.schema.alterTable(table, (t) => {
      t.bigInteger('legacy_id').nullable().unique()
    })
  }

  return false
}

export async function resolveLegacyId(
  pg: DbConnection,
  table: string,
  legacyId: number | null | undefined
): Promise<string | null> {
  if (legacyId === null || legacyId === undefined) return null

  const row = await pg.from(table).select('id').where('legacy_id', legacyId).first()
  return row?.id ?? null
}
