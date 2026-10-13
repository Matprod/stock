const globalAliases = new Map();
export class LegacyResolver {
    pg;
    cache = new Map();
    constructor(pg) {
        this.pg = pg;
    }
    registerAlias(table, fromLegacyId, toLegacyId) {
        if (!globalAliases.has(table)) {
            globalAliases.set(table, new Map());
        }
        globalAliases.get(table).set(fromLegacyId, toLegacyId);
    }
    async resolve(table, legacyId) {
        if (legacyId === null || legacyId === undefined)
            return null;
        const resolvedLegacyId = this.resolveAliasChain(table, Number(legacyId));
        if (!this.cache.has(table)) {
            await this.loadTable(table);
        }
        return this.cache.get(table).get(resolvedLegacyId) ?? null;
    }
    resolveAliasChain(table, legacyId) {
        const aliases = globalAliases.get(table);
        if (!aliases)
            return legacyId;
        let current = legacyId;
        const visited = new Set();
        while (aliases.has(current) && !visited.has(current)) {
            visited.add(current);
            current = aliases.get(current);
        }
        return current;
    }
    async require(table, legacyId) {
        const id = await this.resolve(table, legacyId);
        if (!id)
            return null;
        return id;
    }
    async loadTable(table) {
        const hasColumn = await this.pg.schema.hasColumn(table, 'legacy_id');
        if (!hasColumn) {
            this.cache.set(table, new Map());
            return;
        }
        const rows = await this.pg.from(table).select('id', 'legacy_id').whereNotNull('legacy_id');
        this.cache.set(table, new Map(rows.map((row) => [Number(row.legacy_id), row.id])));
    }
    invalidate(table) {
        this.cache.delete(table);
    }
}
//# sourceMappingURL=legacy_resolver.js.map