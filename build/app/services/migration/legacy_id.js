export async function ensureLegacyIdColumn(pg, table, dryRun) {
    const hasColumn = await pg.schema.hasColumn(table, 'legacy_id');
    if (hasColumn)
        return true;
    if (!dryRun) {
        await pg.schema.alterTable(table, (t) => {
            t.bigInteger('legacy_id').nullable().unique();
        });
    }
    return false;
}
export async function resolveLegacyId(pg, table, legacyId) {
    if (legacyId === null || legacyId === undefined)
        return null;
    const row = await pg.from(table).select('id').where('legacy_id', legacyId).first();
    return row?.id ?? null;
}
//# sourceMappingURL=legacy_id.js.map