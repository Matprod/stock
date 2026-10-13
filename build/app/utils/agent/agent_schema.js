import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FALLBACK_DOMAINS, SERIES_SCHEMA_FALLBACK } from '#constants/agent.constants';
const DB_SCHEMA_PATH = join(dirname(fileURLToPath(import.meta.url)), '../../services/db_schema.md');
let domainsCache = null;
function loadDomains() {
    if (domainsCache)
        return domainsCache;
    const md = readFileSync(DB_SCHEMA_PATH, 'utf-8');
    const domains = [];
    for (const section of md.split(/\n(?=## Domain:)/)) {
        const titleMatch = section.match(/^## Domain:\s*(.+)/);
        const keywordsMatch = section.match(/\*\*Keywords:\*\*\s*(.+)/);
        if (!titleMatch || !keywordsMatch)
            continue;
        domains.push({
            title: titleMatch[1].trim(),
            keywords: keywordsMatch[1].split(',').map((k) => k.trim().toLowerCase()),
            content: section.trim(),
        });
    }
    domainsCache = domains;
    return domains;
}
export const filterSchema = (question, opts) => {
    const domains = loadDomains();
    if (opts?.seriesOnly) {
        const athlete = domains.find((d) => d.title === 'Athlete Identity')?.content ?? '';
        const sport = domains.find((d) => d.title === 'Sport Activities & Training');
        if (!sport)
            return [athlete, SERIES_SCHEMA_FALLBACK].filter(Boolean).join('\n\n---\n\n');
        const section = sport.content.split(/##### series/)[1];
        const seriesPart = section
            ? `## Domain: Sport Activities & Training (series)\n\n##### series${section.split(/\n---/)[0].trim()}`
            : sport.content;
        return [athlete, seriesPart].filter(Boolean).join('\n\n---\n\n');
    }
    if (opts?.forceDomainTitles?.length) {
        const wanted = new Set(opts.forceDomainTitles);
        const forced = domains.filter((d) => wanted.has(d.title));
        if (forced.length > 0)
            return forced.map((d) => d.content).join('\n\n---\n\n');
    }
    const q = question.toLowerCase();
    const ALWAYS = ['Athlete Identity', 'Daily Scores'];
    const matched = domains.filter((d) => {
        if (ALWAYS.includes(d.title))
            return true;
        return d.keywords.some((kw) => {
            const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return new RegExp(`\\b${escaped}\\b`).test(q);
        });
    });
    const result = matched.length > 2 ? matched : domains.filter((d) => FALLBACK_DOMAINS.includes(d.title));
    return result.map((d) => d.content).join('\n\n---\n\n');
};
//# sourceMappingURL=agent_schema.js.map