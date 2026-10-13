export const STRING_COLUMN_MAX_LENGTH = 255;
export const TISSUE_TO_BODY_AREA = {
    'biceps femoris': 'hamstring',
    'bizeps femoris': 'hamstring',
    'semitendinosus': 'hamstring',
    'semimembranosus': 'hamstring',
    'hamstring': 'hamstring',
    'ischiocrural': 'hamstring',
    'rectus femoris': 'quadriceps',
    'vastus medialis': 'quadriceps',
    'vastus intermedius': 'quadriceps',
    'quadriceps': 'quadriceps',
    'quadrizeps': 'quadriceps',
    'adductor longus': 'adductor',
    'adductor magnus': 'adductor',
    'adductor minimus': 'adductor',
    'adductor': 'adductor',
    'adduktor': 'adductor',
    'pectineus': 'adductor',
    'obturator internus': 'adductor',
    'groin': 'adductor',
    'leiste': 'adductor',
    'iliopsoas': 'hip flexor',
    'hueftbeuger': 'hip flexor',
    'hüftbeuger': 'hip flexor',
    'gastrocnemius': 'calf',
    'soleus': 'calf',
    'calf': 'calf',
    'wade': 'calf',
    'gluteus': 'glute',
    'glutaeus': 'glute',
    'rectus abdominis': 'abdomen',
    'intercostal': 'thorax',
    'anconeus': 'elbow',
    'flexor carpi': 'forearm',
    'brachialis': 'arm',
    'achilles tendon': 'Achilles',
    'achillessehne': 'Achilles',
    'biceps tendon': 'shoulder',
    'patellar tendon': 'knee',
    'lcm': 'MCL',
    'innenband': 'MCL',
    'ltta': 'ankle ligament',
    'lfta': 'ankle ligament',
    'lfc': 'ankle ligament',
    'aussenband': 'ankle ligament',
    'außenband': 'ankle ligament',
    'deltoid ligament': 'ankle ligament',
    'lateral ligament': 'ankle ligament',
    'syndesmotic ligament': 'syndesmosis',
    'syndesmose': 'syndesmosis',
    'lucl': 'elbow ligament',
    'rcl': 'elbow ligament',
    'metatarsal': 'foot',
    'fibula': 'lower leg',
    'tibia': 'lower leg',
    'malleolus': 'ankle',
    'sprunggelenk': 'ankle',
    'pubic bone': 'pelvis',
    'zygomatic arch': 'face',
    'femoral head': 'hip',
    'humerus': 'arm',
    'radial head': 'elbow',
    'toe': 'foot',
    'disc': 'lumbar spine',
    'bandscheibe': 'lumbar spine',
    'labrum': 'shoulder',
    'ac joint': 'shoulder',
    'knie': 'knee',
    'schulter': 'shoulder',
    'ellenbogen': 'elbow',
    'fuss': 'foot',
    'fuß': 'foot',
    'unterschenkel': 'lower leg',
    'huefte': 'hip',
    'hüfte': 'hip',
    'lendenwirbel': 'lumbar spine',
    'lenden': 'lumbar spine',
};
export const BODY_AREA_SECTION_ALIASES = {
    'hamstring': ['hamstring'],
    'quadriceps': ['thigh'],
    'adductor': ['groin', 'adductor'],
    'hip flexor': ['groin/hip', 'hip'],
    'calf': ['calf'],
    'glute': ['buttock', 'glute'],
    'abdomen': ['abdomen', 'abdominals'],
    'thorax': ['thorax', 'chest'],
    'elbow': ['elbow'],
    'forearm': ['forearm'],
    'arm': ['biceps', 'triceps'],
    'achilles': ['heel', 'achilles'],
    'shoulder': ['shoulder'],
    'knee': ['knee'],
    'mcl': ['knee'],
    'ankle ligament': ['ankle'],
    'syndesmosis': ['ankle'],
    'elbow ligament': ['elbow'],
    'foot': ['foot'],
    'lower leg': ['lower leg', 'shin', 'fibula'],
    'ankle': ['ankle'],
    'pelvis': ['pelvis'],
    'face': ['head'],
    'hip': ['groin/hip', 'hip'],
    'lumbar spine': ['lumbar spine', 'lumbar'],
};
export function normalizeInjuryText(value) {
    return value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim();
}
export function truncateString(value, maxLength = STRING_COLUMN_MAX_LENGTH) {
    if (value.length <= maxLength)
        return value;
    return value.slice(0, maxLength);
}
function stripSide(name) {
    return normalizeInjuryText(name).replace(/^(left|right)\s+/, '');
}
export function extractTissueAndBodyArea(injuryText) {
    if (!injuryText)
        return { matchedTissue: null, bodyArea: null };
    const normalizedInjury = normalizeInjuryText(injuryText);
    let bestMatch = null;
    for (const tissue of Object.keys(TISSUE_TO_BODY_AREA)) {
        const key = normalizeInjuryText(tissue);
        if (normalizedInjury.includes(key)) {
            if (!bestMatch || key.length > normalizeInjuryText(bestMatch).length) {
                bestMatch = tissue;
            }
        }
    }
    if (!bestMatch)
        return { matchedTissue: null, bodyArea: null };
    return { matchedTissue: bestMatch, bodyArea: TISSUE_TO_BODY_AREA[bestMatch] ?? null };
}
export function findSectionForBodyArea(bodyArea, sections, naSection) {
    if (!bodyArea)
        return { section: naSection, usedNa: true };
    const aliases = BODY_AREA_SECTION_ALIASES[normalizeInjuryText(bodyArea)] ?? [
        normalizeInjuryText(bodyArea),
    ];
    const candidates = [];
    for (const section of sections) {
        const base = stripSide(section.name);
        const sided = /^(left|right)\s+/i.test(section.name);
        for (const alias of aliases) {
            const aliasNorm = normalizeInjuryText(alias);
            if (!aliasNorm)
                continue;
            let score = 0;
            if (base === aliasNorm)
                score = 100;
            else if (aliasNorm.length >= 4 && base.includes(aliasNorm))
                score = 70;
            else if (aliasNorm.length >= 4 && aliasNorm.includes(base) && base.length >= 4)
                score = 50;
            else
                continue;
            if (!sided)
                score += 20;
            score += Math.min(base.length, 30);
            candidates.push({ section, score });
        }
    }
    if (candidates.length === 0)
        return { section: naSection, usedNa: true };
    candidates.sort((a, b) => b.score - a.score);
    return { section: candidates[0].section, usedNa: false };
}
export function mapContactType(value) {
    if (!value)
        return null;
    const normalized = normalizeInjuryText(value).replace(/[_-]+/g, ' ');
    if (normalized.includes('semi') || normalized.includes('semo'))
        return 'semi_contact';
    if (normalized.includes('no contact') || normalized.includes('non contact'))
        return 'no_contact';
    if (normalized.includes('contact'))
        return 'contact';
    return null;
}
export function mapInjuryContext(value) {
    if (!value)
        return null;
    const normalized = normalizeInjuryText(value);
    if (normalized.includes('training') ||
        normalized.includes('trainingslager') ||
        normalized === 'training') {
        return 'training';
    }
    if (normalized.includes('match') ||
        normalized.includes('punktspiel') ||
        normalized.includes('testspiel') ||
        normalized.includes('turnier') ||
        normalized.includes('spiel')) {
        return 'match';
    }
    return 'other';
}
export function injuriesCoincide(params) {
    if (!params.dateA?.isValid || !params.dateB?.isValid)
        return false;
    const days = Math.abs(params.dateA.startOf('day').diff(params.dateB.startOf('day'), 'days').days);
    if (days > 1)
        return false;
    const tissueA = params.tissueA ? normalizeInjuryText(params.tissueA) : null;
    const tissueB = params.tissueB ? normalizeInjuryText(params.tissueB) : null;
    if (tissueA && tissueB) {
        if (tissueA === tissueB || tissueA.includes(tissueB) || tissueB.includes(tissueA)) {
            return true;
        }
    }
    if (params.sectionIdA && params.sectionIdB && params.sectionIdA === params.sectionIdB) {
        return true;
    }
    const areaA = extractTissueAndBodyArea(params.pathologyA ?? null).bodyArea ??
        extractTissueAndBodyArea(params.tissueA ?? null).bodyArea;
    const areaB = extractTissueAndBodyArea(params.pathologyB ?? null).bodyArea ??
        extractTissueAndBodyArea(params.tissueB ?? null).bodyArea;
    if (areaA && areaB && normalizeInjuryText(areaA) === normalizeInjuryText(areaB)) {
        return true;
    }
    const pathA = params.pathologyA ? normalizeInjuryText(params.pathologyA) : null;
    const pathB = params.pathologyB ? normalizeInjuryText(params.pathologyB) : null;
    if (pathA && pathB && pathA.length >= 8 && pathB.length >= 8) {
        if (pathA.includes(pathB) || pathB.includes(pathA))
            return true;
    }
    return false;
}
//# sourceMappingURL=injury_body_area.js.map