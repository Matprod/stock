
import { readFileSync, writeFileSync } from 'node:fs'
import { linkDisplayedNumbersToFacts, toAutolinkMeasureStats } from '#services/report_v4/fact_autolink'
import type { PremiumDataset } from '#contracts/premium_report'

const tag = process.argv[2]
const html = readFileSync(`tmp/canari_runs/${tag}.html`, 'utf8')
const doc = JSON.parse(readFileSync(`tmp/canari_runs/${tag}.document.json`, 'utf8'))
const datasets: PremiumDataset[] = []
// reconstruct minimal datasets from document tables if present
for (const b of doc.blocks ?? []) {
  if (b.type === 'table' && Array.isArray(b.rows) && b.columns) {
    datasets.push({ id: b.id, columns: b.columns, rows: b.rows })
  }
}
const athleteNames = (doc.blocks ?? [])
  .filter((b: any) => b.type === 'heading' && b.level === 2)
  .map((b: any) => String(b.text || '').trim())
  .filter(Boolean)
const result = linkDisplayedNumbersToFacts({
  html,
  datasets,
  language: 'fr',
  athleteNames,
})
const stats = toAutolinkMeasureStats ? toAutolinkMeasureStats(result.stats) : {
  linked: (result.stats.linkedFact ?? 0) + (result.stats.linkedSrc ?? 0),
  ambiguous: result.stats.ambiguous ?? 0,
  unmatched: result.stats.unmatched ?? 0,
  false: 0,
}
writeFileSync(`tmp/canari_runs/${tag}.autolink.json`, JSON.stringify({ stats: result.stats, measure: stats, athleteNames: athleteNames.length, datasets: datasets.length }, null, 2))
console.log(tag, JSON.stringify({ measure: stats, raw: result.stats, athletes: athleteNames.length, datasets: datasets.length }))
