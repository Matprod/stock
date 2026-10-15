import { fr, mean } from '#services/report_v4/chart_svg/format'
import { perfClass, riskClass } from '#services/report_v4/chart_svg/charts'
import type { MatrixInput, MatrixRow } from '#services/report_v4/chart_svg/types'

export const matrixHeatmap = ({
  rows,
  dayLetters,
  dayNumbers,
  avgLabel = 'Avg',
  teamLabel = 'Team mean',
}: MatrixInput) => {
  const sorted = [...rows].sort((a, b) => b.riskMean - a.riskMean)
  const head = dayLetters
    .map((l, i) => `<span class="dh">${l}<br>${dayNumbers[i]}</span>`)
    .join('')
  const rowHtml = (r: MatrixRow) =>
    `<div class="mx${r.focus ? ' focus' : ''}"><span class="nm">${r.label}</span>${r.risk.map((v) => `<span class="${riskClass(v)}">${v}</span>`).join('')}<span class="mn">${fr(r.riskMean)}</span><span></span>${r.perf.map((v) => `<span class="${perfClass(v)}">${v}</span>`).join('')}<span class="mn">${fr(r.perfMean)}</span></div>`
  const dayCount = dayLetters.length
  const tR = Array.from({ length: dayCount }, (_, i) => mean(sorted.map((r) => r.risk[i])))
  const tP = Array.from({ length: dayCount }, (_, i) => mean(sorted.map((r) => r.perf[i])))
  return `<div class="chart-matrix">
    <div class="mx head"><span></span>${head}<span class="dh">${avgLabel}</span><span></span>${head}<span class="dh">${avgLabel}</span></div>
    ${sorted.map(rowHtml).join('\n    ')}
    <div class="mx team"><span class="nm" style="color:var(--ink);font-weight:600">${teamLabel}</span>${tR.map((v) => `<span>${fr(v)}</span>`).join('')}<span class="mn">${fr(mean(tR))}</span><span></span>${tP.map((v) => `<span>${fr(v)}</span>`).join('')}<span class="mn">${fr(mean(tP))}</span></div>
  </div>`
}
