export const SAPSPORTSONE_HEALTH_METRICS = [
    'pre_training_rpe',
    'post_training_rpe',
    'injury_status',
    'at_it_rt_rpe',
];
export const SAPSPORTSONE_QUESTION_MAPPINGS = [
    {
        questionName: 'Sleep',
        aliases: ['Schlaf', 'SCHLAF', 'Schlafqualität'],
        target: { kind: 'sleep', field: 'qualityRating' },
        category: 'daily_questionnaire',
    },
    {
        questionIds: ['5B12698D6AA94BF8B8E01CE74D7E394A'],
        questionName: 'körperliches Befinden',
        aliases: ['RPE Body', 'RPE Körper'],
        target: { kind: 'health_rating', field: 'bodySorenessRating' },
        category: 'daily_questionnaire',
    },
    {
        questionIds: ['6E9C661FDCA3467FA29AC75BAC68798C'],
        questionName: 'körperliches Befinden (10-60)',
        target: { kind: 'health_rating', field: 'bodySorenessRating' },
        category: 'daily_questionnaire',
    },
    {
        questionName: 'Status Verletzung',
        target: { kind: 'health_metric', metric: 'injury_status' },
        category: 'daily_questionnaire',
    },
    {
        questionIds: ['380CF212A24549ACA42461A75BBA0D3C'],
        questionName: 'mentales Befinden',
        aliases: ['RPE mental'],
        target: { kind: 'health_rating', field: 'moodRating' },
        category: 'daily_questionnaire',
    },
    {
        questionIds: ['F02D791E6F884991AFCA1FFB76734FFF'],
        questionName: 'Anstrengung Mannschaftstraining',
        aliases: ['RPE Training'],
        target: { kind: 'training_rpe' },
        category: 'training_rpe',
    },
    {
        questionIds: ['E05DDE01DD624E82AE4C117100FCC3B1'],
        questionName: 'RPE Training (FBL, 10-60)',
        target: { kind: 'training_rpe' },
        category: 'training_rpe',
    },
    {
        questionName: 'RPE AT/IT/RT',
        target: { kind: 'health_metric', metric: 'at_it_rt_rpe' },
        category: 'training_rpe',
    },
];
export function normalizeSapQuestionName(value) {
    return value
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/\s+/g, ' ');
}
function mappingNames(mapping) {
    return [mapping.questionName, ...(mapping.aliases ?? [])];
}
export function findSapQuestionMappingById(questionId) {
    if (!questionId)
        return null;
    const normalized = questionId.trim().toUpperCase();
    return (SAPSPORTSONE_QUESTION_MAPPINGS.find((mapping) => (mapping.questionIds ?? []).some((id) => id.toUpperCase() === normalized)) ?? null);
}
export function findSapQuestionMappingByName(questionName) {
    if (!questionName)
        return null;
    const normalized = normalizeSapQuestionName(questionName);
    return (SAPSPORTSONE_QUESTION_MAPPINGS.find((mapping) => mappingNames(mapping).some((name) => normalizeSapQuestionName(name) === normalized)) ?? null);
}
export function findSapQuestionMapping(questionId, questionName) {
    return findSapQuestionMappingById(questionId) ?? findSapQuestionMappingByName(questionName);
}
//# sourceMappingURL=sapsportsone.constants.js.map