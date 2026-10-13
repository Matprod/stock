import { join } from 'node:path';
export const HAMBOURG_DIR = join(process.cwd(), 'hambourg');
export const PLAYER_LIST_FILE = join(HAMBOURG_DIR, 'player-list.csv');
export const SAPSPORTSONE_QUEST_PERSONS_FILE = join(HAMBOURG_DIR, 'sapsportsone_quest_persons.csv');
export const PLAYER_MAPPING_SAP_SKILLCORNER_DFL_FILE = join(HAMBOURG_DIR, 'player_mapping_sap_skillcorner_dfl.csv');
export const STATS_SPORTS_FILE = join(HAMBOURG_DIR, 'stats-sports.xlsx');
export const STATS_SPORTS_SHEET = 'Sheet1';
export const DIAGNOSTIK_FILE = join(HAMBOURG_DIR, 'diagnostik.xlsx');
export const DIAGNOSTIK_SHEET = 'Diagnostics';
export const MEDECINE_FILE = join(HAMBOURG_DIR, 'medecine.xlsx');
export const MEDECINE_SAP_MAPPING_FILE = join(HAMBOURG_DIR, 'medecine_sap_mapping.csv');
export const CK_TESTS_FILE = join(HAMBOURG_DIR, 'ck_tests.xlsx');
export const CK_TESTS_SHEET = 'CK';
export const TRANSFERMARKET_FILE = join(HAMBOURG_DIR, 'transfermarket.csv');
export const STATSSPORTS_PERIOD_METRICS_FILE = join(HAMBOURG_DIR, 'statsports_period_metrics_db.csv');
export const HAMBOURG_CLUB_ID = '019fa7cc-684c-783e-9609-c132a26eb4e3';
export const FOOTBALL_SPORT_ID = '019f5371-fc3e-7a24-aee7-8296d472acc7';
export const FOOTBALL_ACTIVITY_TYPE_ID = '019f5373-1df6-79cb-a2c8-40f9713fd335';
export const HAMBOURG_SKILLCORNER_TEAM_ID = 101;
export const HAMBOURG_DFL_CLUB_ID = 'DFL-CLU-00000C';
export const HAMBOURG_DEFAULT_PASSWORD = 'DEFAULT_PASS';
export const HAMBOURG_EMAIL_DOMAIN = 'hamourg-test.com';
function normalizeSessionType(value) {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
}
export const HAMBOURG_TEAM_EXCEL_COLUMN = 'Team';
export const HAMBOURG_TEAM_NAME = 'FBL';
export const HAMBOURG_POSITION_EXCEL_COLUMN = 'PLAYER POSITION';
export function isHambourgFblTeam(value) {
    if (value === null || value === undefined)
        return false;
    return String(value).trim().toUpperCase() === HAMBOURG_TEAM_NAME;
}
export function isHambourgGoalkeeper(value) {
    if (value === null || value === undefined)
        return false;
    const normalized = String(value)
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, '');
    return (normalized === 'goalkeeper' ||
        normalized === 'gk' ||
        normalized === 'torwart' ||
        normalized === 'torhüter' ||
        normalized === 'torhuter');
}
export function isHambourgImportRow(row) {
    if (!isHambourgFblTeam(row[HAMBOURG_TEAM_EXCEL_COLUMN]))
        return false;
    if (isHambourgGoalkeeper(row[HAMBOURG_POSITION_EXCEL_COLUMN]))
        return false;
    return true;
}
export function isHambourgApiImportRow(row) {
    return !isHambourgGoalkeeper(row.player_primaryPosition);
}
export function isStatsportsGameSession(sessionType) {
    if (!sessionType)
        return false;
    const normalized = normalizeSessionType(String(sessionType));
    if (/match\s*day\s*[-+]/.test(normalized))
        return false;
    if (/match\s*day.*\bgps\b/.test(normalized))
        return false;
    if (/macth\s*day/.test(normalized))
        return false;
    const compact = normalized.replace(/[\s_-]+/g, '');
    return compact === 'friendlymatch' || compact === 'matchday';
}
//# sourceMappingURL=hambourg.constants.js.map