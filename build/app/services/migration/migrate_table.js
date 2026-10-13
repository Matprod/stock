import { ensureLegacyIdColumn } from '#services/migration/legacy_id';
import { LegacyResolver } from '#services/migration/legacy_resolver';
import { splitBilingualName } from '#services/migration/bilingual';
import { insertEntityTranslations, } from '#services/migration/entity_translations';
const DEFAULT_BATCH_SIZE = 500;
export const LARGE_BATCH = 500;
export const XL_BATCH = 2_000;
let batchSizeOverride;
export function setMigrationBatchSizeOverride(size) {
    batchSizeOverride = size;
}
function resolveBatchSize(def) {
    return batchSizeOverride ?? def.batchSize ?? DEFAULT_BATCH_SIZE;
}
function resolveOrderBy(def) {
    return def.orderBy ?? { column: 'id', direction: 'asc' };
}
async function fetchMysqlBatch(mysql, table, batchSize, orderBy, cursor) {
    const direction = orderBy.direction ?? 'asc';
    let query = mysql.from(table).select('*');
    if (cursor !== null) {
        query =
            direction === 'asc'
                ? query.where(orderBy.column, '>', cursor)
                : query.where(orderBy.column, '<', cursor);
    }
    return query.orderBy(orderBy.column, direction).limit(batchSize);
}
export function createMigrator(def) {
    return (mysql, pg, dryRun) => runTableMigration(def, mysql, pg, dryRun);
}
export function createBilingualMigrator(def) {
    return (mysql, pg, dryRun) => runBilingualTableMigration(def, mysql, pg, dryRun);
}
export async function runBilingualTableMigration(def, mysql, pg, dryRun) {
    const hasLegacyId = await ensureLegacyIdColumn(pg, def.pgTable, dryRun);
    const resolver = new LegacyResolver(pg);
    const batchSize = resolveBatchSize(def);
    const [{ total }] = await mysql.from(def.mysqlTable).count('* as total');
    const totalCount = Number(total);
    let existingLegacyIds = new Set();
    if (hasLegacyId) {
        const existing = await pg.from(def.pgTable).select('legacy_id').whereNotNull('legacy_id');
        existingLegacyIds = new Set(existing.map((row) => Number(row.legacy_id)));
    }
    let inserted = 0;
    let skipped = 0;
    let rejected = 0;
    const orderBy = resolveOrderBy(def);
    let cursor = null;
    while (true) {
        const rows = await fetchMysqlBatch(mysql, def.mysqlTable, batchSize, orderBy, cursor);
        if (rows.length === 0)
            break;
        const toInsert = [];
        const translationRows = [];
        for (const row of rows) {
            const legacyId = Number(row.id);
            if (existingLegacyIds.has(legacyId)) {
                skipped++;
                continue;
            }
            const bilingual = splitBilingualName(row);
            if (!bilingual) {
                rejected++;
                continue;
            }
            const mapped = await def.mapRow(row, bilingual, resolver);
            if (!mapped) {
                rejected++;
                continue;
            }
            toInsert.push({ ...mapped, name: bilingual.name, legacy_id: legacyId });
            translationRows.push({ legacyId, translation: bilingual.translation });
        }
        const duplicates = toInsert.filter((row, index, self) => self.findIndex((t) => t.name === row.name && t.category_id === row.category_id) !== index);
        if (duplicates.length > 0) {
            console.log('Duplicates:', duplicates);
        }
        if (!dryRun && toInsert.length > 0) {
            if (def.conflictColumns && def.conflictColumns.length > 0) {
                await pg
                    .knexQuery()
                    .table(def.pgTable)
                    .insert(toInsert)
                    .onConflict(def.conflictColumns)
                    .ignore();
            }
            else {
                await pg.table(def.pgTable).multiInsert(toInsert);
            }
            resolver.invalidate(def.pgTable);
            await insertEntityTranslations(pg, dryRun, translationRows, {
                pgTable: def.pgTable,
                translatableType: def.translatableType,
                translationKey: def.translationKey,
            });
        }
        inserted += toInsert.length;
        cursor = rows[rows.length - 1][orderBy.column];
        if (rows.length < batchSize)
            break;
    }
    return {
        table: def.pgTable,
        total: totalCount,
        inserted,
        skipped,
        rejected,
    };
}
export async function runTableMigration(def, mysql, pg, dryRun) {
    const hasLegacyId = await ensureLegacyIdColumn(pg, def.pgTable, dryRun);
    const resolver = new LegacyResolver(pg);
    const batchSize = resolveBatchSize(def);
    const [{ total }] = await mysql.from(def.mysqlTable).count('* as total');
    const totalCount = Number(total);
    let existingLegacyIds = new Set();
    if (hasLegacyId) {
        const existing = await pg.from(def.pgTable).select('legacy_id').whereNotNull('legacy_id');
        existingLegacyIds = new Set(existing.map((row) => Number(row.legacy_id)));
    }
    let inserted = 0;
    let skipped = 0;
    let rejected = 0;
    const orderBy = resolveOrderBy(def);
    let cursor = null;
    while (true) {
        const rows = await fetchMysqlBatch(mysql, def.mysqlTable, batchSize, orderBy, cursor);
        if (rows.length === 0)
            break;
        const toInsert = [];
        for (const row of rows) {
            const legacyId = Number(row.id);
            if (existingLegacyIds.has(legacyId)) {
                skipped++;
                continue;
            }
            const mapped = await def.mapRow(row, resolver);
            if (!mapped) {
                rejected++;
                continue;
            }
            toInsert.push({ ...mapped, legacy_id: legacyId });
        }
        if (!dryRun && toInsert.length > 0) {
            if (def.conflictColumns && def.conflictColumns.length > 0) {
                await pg
                    .knexQuery()
                    .table(def.pgTable)
                    .insert(toInsert)
                    .onConflict(def.conflictColumns)
                    .ignore();
            }
            else {
                await pg.table(def.pgTable).multiInsert(toInsert);
            }
            resolver.invalidate(def.pgTable);
        }
        inserted += toInsert.length;
        cursor = rows[rows.length - 1][orderBy.column];
        if (rows.length < batchSize)
            break;
    }
    return {
        table: def.pgTable,
        total: totalCount,
        inserted,
        skipped,
        rejected,
    };
}
//# sourceMappingURL=migrate_table.js.map