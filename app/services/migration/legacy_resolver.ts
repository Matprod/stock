import type { DbConnection } from '#services/migration/types'

const globalAliases = new Map<string, Map<number, number>>()

export class LegacyResolver {
  private cache = new Map<string, Map<number, string>>()

  constructor(private pg: DbConnection) {}

  registerAlias(table: string, fromLegacyId: number, toLegacyId: number) {
    if (!globalAliases.has(table)) {
      globalAliases.set(table, new Map())
    }
    globalAliases.get(table)!.set(fromLegacyId, toLegacyId)
  }

  async resolve(table: string, legacyId: number | null | undefined): Promise<string | null> {
    if (legacyId === null || legacyId === undefined) return null

    const resolvedLegacyId = this.resolveAliasChain(table, Number(legacyId))

    if (!this.cache.has(table)) {
      await this.loadTable(table)
    }

    return this.cache.get(table)!.get(resolvedLegacyId) ?? null
  }

  private resolveAliasChain(table: string, legacyId: number): number {
    const aliases = globalAliases.get(table)
    if (!aliases) return legacyId

    let current = legacyId
    const visited = new Set<number>()
    while (aliases.has(current) && !visited.has(current)) {
      visited.add(current)
      current = aliases.get(current)!
    }
    return current
  }

  async require(table: string, legacyId: number | null | undefined): Promise<string | null> {
    const id = await this.resolve(table, legacyId)
    if (!id) return null
    return id
  }

  private async loadTable(table: string) {
    const hasColumn = await this.pg.schema.hasColumn(table, 'legacy_id')
    if (!hasColumn) {
      this.cache.set(table, new Map())
      return
    }

    const rows = await this.pg.from(table).select('id', 'legacy_id').whereNotNull('legacy_id')
    this.cache.set(
      table,
      new Map(rows.map((row) => [Number(row.legacy_id), row.id as string]))
    )
  }

  invalidate(table: string) {
    this.cache.delete(table)
  }
}
