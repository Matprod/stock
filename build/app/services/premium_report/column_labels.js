const LABELS_FR = {
    date_of_day: 'Date',
    date: 'Date',
    joueur: 'Joueur',
    player: 'Joueur',
    athlete: 'Athlète',
    poste: 'Poste',
    position: 'Poste',
    activite: 'Activité',
    type_activite: 'Activité',
    activity: 'Activité',
    activity_type: 'Activité',
    nb_joueurs: 'Nb joueurs',
    n: 'N',
    unit: 'Unité',
    distance_m: 'Distance',
    total_distance_m: 'Distance totale',
    hmld_m: 'HMLD',
    hsr_m: 'HSR',
    sprints: 'Sprints',
    sprint_distance_m: 'Distance sprint',
    max_speed: 'Vitesse max',
    accelerations: 'Accélérations',
    decelerations: 'Décélérations',
    accel_hi: 'Accél. haute intensité',
    decel_hi: 'Décél. haute intensité',
    accel_hi_moy: 'Accél. HI (moy.)',
    decel_hi_moy: 'Décél. HI (moy.)',
    cod_total: 'COD total',
    cod_total_moy: 'COD total (moy.)',
    avg_hr: 'FC moy.',
    dsl: 'Player Load (DSL)',
    player_load: 'Player Load',
    charge: 'Charge',
    total_minutes: 'Minutes',
    minutes: 'Minutes',
    minutes_total: 'Minutes total',
    minutes_moy: 'Minutes (moy.)',
    nb_matchs: 'Nb matchs',
    tackles_won: 'Tacles gagnés',
    tackles_contested: 'Tacles contestés',
    intensive_run_m: 'Course intensive',
    srpe_daily: 'sRPE journalier',
    srpe_total: 'sRPE total',
    ewma_7: 'EWMA 7j',
    ewma_28: 'EWMA 28j',
    monotony: 'Monotonie',
    strain: 'Strain',
    acwr_ewma: 'ACWR',
    acwr: 'ACWR',
    biomarqueur: 'Biomarqueur',
    valeur: 'Valeur',
    nb_mesures: 'Nb mesures',
    poids_kg: 'Poids',
    masse_grasse_pct: 'Masse grasse',
    test_type: 'Type de test',
    jump_height_moy: 'Hauteur saut (moy.)',
    jump_height_max: 'Hauteur saut (max)',
    courbatures: 'Courbatures',
    energie: 'Énergie',
    humeur: 'Humeur',
    stress: 'Stress',
    qualite_sommeil: 'Qualité sommeil',
    heures_lit: 'Heures au lit',
    x_column: 'X',
    y_column: 'Y',
    correlation: 'Corrélation',
    r: 'r',
    method: 'Méthode',
};
const LABELS_EN = {
    date_of_day: 'Date',
    date: 'Date',
    joueur: 'Player',
    player: 'Player',
    athlete: 'Athlete',
    poste: 'Position',
    position: 'Position',
    activite: 'Activity',
    type_activite: 'Activity',
    activity: 'Activity',
    activity_type: 'Activity',
    nb_joueurs: 'Players (n)',
    n: 'N',
    unit: 'Unit',
    distance_m: 'Distance',
    total_distance_m: 'Total distance',
    hmld_m: 'HMLD',
    hsr_m: 'HSR',
    sprints: 'Sprints',
    sprint_distance_m: 'Sprint distance',
    max_speed: 'Max speed',
    accelerations: 'Accelerations',
    decelerations: 'Decelerations',
    accel_hi: 'High-intensity accel.',
    decel_hi: 'High-intensity decel.',
    accel_hi_moy: 'HI accel. (avg)',
    decel_hi_moy: 'HI decel. (avg)',
    cod_total: 'COD total',
    cod_total_moy: 'COD total (avg)',
    avg_hr: 'Avg HR',
    dsl: 'Player Load (DSL)',
    player_load: 'Player Load',
    charge: 'Load',
    total_minutes: 'Minutes',
    minutes: 'Minutes',
    minutes_total: 'Total minutes',
    minutes_moy: 'Minutes (avg)',
    nb_matchs: 'Matches (n)',
    tackles_won: 'Tackles won',
    tackles_contested: 'Tackles contested',
    intensive_run_m: 'Intensive run',
    srpe_daily: 'Daily sRPE',
    srpe_total: 'Total sRPE',
    ewma_7: 'EWMA 7d',
    ewma_28: 'EWMA 28d',
    monotony: 'Monotony',
    strain: 'Strain',
    acwr_ewma: 'ACWR',
    acwr: 'ACWR',
    biomarqueur: 'Biomarker',
    valeur: 'Value',
    nb_mesures: 'Samples (n)',
    poids_kg: 'Weight',
    masse_grasse_pct: 'Body fat',
    test_type: 'Test type',
    jump_height_moy: 'Jump height (avg)',
    jump_height_max: 'Jump height (max)',
    courbatures: 'Soreness',
    energie: 'Energy',
    humeur: 'Mood',
    stress: 'Stress',
    qualite_sommeil: 'Sleep quality',
    heures_lit: 'Time in bed',
    x_column: 'X',
    y_column: 'Y',
    correlation: 'Correlation',
    r: 'r',
    method: 'Method',
};
const looksTechnical = (name) => /_/.test(name) || /^[a-z]+(?:[A-Z][a-z0-9]*)+$/.test(name);
const titleCaseWords = (value) => value
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
const withUnit = (label, unit) => {
    if (!unit)
        return label;
    const trimmed = unit.trim();
    if (!trimmed)
        return label;
    if (/\(.*\)\s*$/.test(label))
        return label;
    return `${label} (${trimmed})`;
};
const uniqueDisplayLabel = (base, used) => {
    let label = base;
    if (used.has(label)) {
        let i = 2;
        while (used.has(`${base} (${i})`))
            i += 1;
        label = `${base} (${i})`;
    }
    used.add(label);
    return label;
};
export const displayColumnLabel = (name, language = 'fr', units) => {
    const trimmed = name.trim();
    if (!trimmed)
        return trimmed;
    const key = trimmed.toLowerCase();
    const mapped = (language === 'en' ? LABELS_EN : LABELS_FR)[key];
    const base = mapped ?? (looksTechnical(trimmed) ? titleCaseWords(trimmed) : trimmed);
    const unit = units?.[trimmed] ?? units?.[key];
    return withUnit(base, unit);
};
export const relabelDatasetColumns = (dataset, language = 'fr') => {
    const used = new Set();
    const rename = new Map();
    for (const column of dataset.columns) {
        const label = uniqueDisplayLabel(displayColumnLabel(column, language, dataset.units), used);
        rename.set(column, label);
    }
    const nextUnits = {};
    if (dataset.units) {
        for (const [column, unit] of Object.entries(dataset.units)) {
            const label = rename.get(column);
            if (label)
                nextUnits[label] = unit;
        }
    }
    return {
        ...dataset,
        columns: dataset.columns.map((column) => rename.get(column) ?? column),
        rows: dataset.rows.map((row) => {
            const next = {};
            for (const [key, value] of Object.entries(row)) {
                next[rename.get(key) ?? displayColumnLabel(key, language, dataset.units)] = value;
            }
            return next;
        }),
        ...(Object.keys(nextUnits).length ? { units: nextUnits } : {}),
    };
};
export const relabelTableColumns = (columns, language = 'fr', units) => {
    const used = new Set();
    return columns.map((column) => uniqueDisplayLabel(displayColumnLabel(column, language, units), used));
};
//# sourceMappingURL=column_labels.js.map