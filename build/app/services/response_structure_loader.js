import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
export const RESPONSE_STRUCTURE_INTENTS = [
    'metric_deep_analysis',
    'strategic_evaluation',
    'conceptual_clarification',
    'hypothesis_claim_checking',
    'direct_data_question',
    'global_analysis',
    'contributing_variable_analysis',
    'general',
];
let intentSectionsCache = null;
function loadIntentSections() {
    if (intentSectionsCache)
        return intentSectionsCache;
    const mdPath = join(__dirname, 'response_structure.md');
    const md = readFileSync(mdPath, 'utf-8');
    const map = new Map();
    for (const part of md.split(/\n(?=## Intent:)/)) {
        const match = part.match(/^## Intent:\s*(\S+)/);
        if (!match)
            continue;
        const id = match[1].trim();
        map.set(id, part.trim());
    }
    intentSectionsCache = map;
    return map;
}
export function getResponseStructure(intent) {
    const map = loadIntentSections();
    return map.get(intent.trim()) ?? null;
}
//# sourceMappingURL=response_structure_loader.js.map