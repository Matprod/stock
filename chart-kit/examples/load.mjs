import fs from 'node:fs';
const read = (f) => JSON.parse(fs.readFileSync(new URL(f, import.meta.url), 'utf8'));
export const NAMES = ['trend', 'ranking', 'contribution', 'deviation', 'distribution'];
export function loadExample(name) { const d = read(`./data.${name}.json`); return { spec: read(`./spec.${name}.json`), rows: d.rows, reference: d.reference }; }
export const loadPacks = () => read('../../design-packs-kit/packs.json').packs;
