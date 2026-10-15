import { dayShort, f1, fr, int, PCT, svgOpen } from '#services/report_v4/chart_svg/format'
import type {
  AcwrSeries,
  BarItem,
  DeviationItem,
  DotStripRow,
  LineSeries,
  ScatterPoint,
  SmallMultiplePanel,
  TimelineRow,
} from '#services/report_v4/chart_svg/types'

export const sparkline = (
  values: number[],
  {
    w = 300,
    h = 84,
    from = dayShort(2),
    to = dayShort(8),
    ref = 50,
  }: { w?: number; h?: number; from?: string; to?: string; ref?: number } = {}
) => {
  const x0 = 22
  const x1 = w - 30
  const y0 = 16
  const y1 = h - 20
  const X = (i: number) => x0 + (i * (x1 - x0)) / (values.length - 1)
  const Y = (v: number) => y1 - (v / 100) * (y1 - y0)
  const pts = values.map((v, i) => `${f1(X(i))},${f1(Y(v))}`).join(' ')
  const iMax = values.indexOf(Math.max(...values))
  const iMin = values.lastIndexOf(Math.min(...values))
  const keep = [...new Set([0, iMax, iMin, values.length - 1])]
  const labels = keep
    .map((i) => {
      const last = i === values.length - 1
      const above = i === iMax || (i !== iMin && values[i] >= values[Math.max(0, i - 1)])
      const y = last ? Y(values[i]) + 4 : above ? Y(values[i]) - 8 : Y(values[i]) + 15
      const anchor = last || i === 0 ? 'start' : 'middle'
      const dx = last ? 8 : i === 0 ? -4 : 0
      return `<text class="value" x="${f1(X(i) + dx)}" y="${f1(y)}" text-anchor="${anchor}">${values[i]}</text>`
    })
    .join('')
  return `${svgOpen(w, h, 'Daily risk')}
    <line class="line-ref" x1="${x0}" x2="${x1}" y1="${Y(ref)}" y2="${Y(ref)}"/>
    <text class="tick" x="0" y="${Y(ref) + 3.5}">${ref}</text>
    <line class="axis" x1="${x0}" x2="${x1}" y1="${y1 + 0.5}" y2="${y1 + 0.5}"/>
    <polyline class="line-risk" points="${pts}"/>
    ${values.map((v, i) => `<circle class="dot-risk" cx="${f1(X(i))}" cy="${f1(Y(v))}" r="${keep.includes(i) ? 3.5 : 2.5}"/>`).join('')}
    ${labels}
    <text class="tick" x="${x0}" y="${h - 3}">${from}</text>
    <text class="tick" x="${x1}" y="${h - 3}" text-anchor="end">${to}</text>
  </svg>`
}

export const lineChart = ({
  series,
  xLabels,
  w = 698,
  h = 210,
  annotation,
  sessionDays = [],
}: {
  series: LineSeries[]
  xLabels: string[]
  w?: number
  h?: number
  annotation?: { from: number; to: number; text: string }
  sessionDays?: number[]
}) => {
  const x0 = 34
  const x1 = w - 128
  const y0 = 30
  const y1 = h - 44
  const X = (i: number) => x0 + (i * (x1 - x0)) / (xLabels.length - 1)
  const Y = (v: number) => y1 - (v / 100) * (y1 - y0)
  let s = svgOpen(w, h, 'Score by day')
  for (const tick of [0, 25, 50, 75, 100]) {
    s += `<line class="${tick === 0 ? 'axis' : 'grid'}" x1="${x0}" x2="${x1}" y1="${Y(tick)}" y2="${Y(tick)}"/>`
    s += `<text class="tick" x="${x0 - 8}" y="${Y(tick) + 3.5}" text-anchor="end">${tick}</text>`
  }
  xLabels.forEach((d, i) => {
    s += `<text class="tick" x="${X(i)}" y="${y1 + 16}" text-anchor="middle">${d}</text>`
    if (sessionDays.includes(i))
      s += `<path d="M${X(i)} ${y1 + 23}l3.5 3.5-3.5 3.5-3.5-3.5z" fill="var(--ink-2)"/>`
  })
  if (annotation) {
    const ya = y0 - 14
    const a = X(annotation.from)
    const b = X(annotation.to)
    s += `<path d="M${a} ${ya + 6}V${ya}H${b}V${ya + 6}" fill="none" stroke="var(--ink-3)" stroke-width="1"/>`
    s += `<text class="annot" x="${(a + b) / 2}" y="${ya - 4}" text-anchor="middle" style="font-weight:600;fill:var(--ink)">${annotation.text}</text>`
  }
  for (const se of series) {
    s += `<polyline class="line-${se.kind}" points="${se.values.map((v, i) => `${f1(X(i))},${f1(Y(v))}`).join(' ')}"/>`
    se.values.forEach((v, i) => {
      s +=
        se.kind === 'risk'
          ? `<circle class="dot-risk" cx="${f1(X(i))}" cy="${f1(Y(v))}" r="3.5"/>`
          : `<rect class="dot-perf" x="${f1(X(i) - 3.5)}" y="${f1(Y(v) - 3.5)}" width="7" height="7"/>`
    })
    for (const i of se.labelAt || []) {
      const dy = (se.below || []).includes(i) ? 16 : -9
      s += `<text class="value" x="${f1(X(i))}" y="${f1(Y(se.values[i]) + dy)}" text-anchor="middle">${se.values[i]}</text>`
    }
    const last = se.values[se.values.length - 1]
    s += `<text class="value" x="${x1 + 12}" y="${f1(Y(last) + 4)}" style="fill:var(--${se.kind})">${se.name} ${last}</text>`
  }
  return s + '</svg>'
}

export const hbars = ({
  items,
  w = 330,
  row = 24,
  labelW = 118,
  max,
  ref,
  fmt = int,
  highlight = 'lead',
  missingNote,
}: {
  items: BarItem[]
  w?: number
  row?: number
  labelW?: number
  max?: number
  ref?: { value: number; label: string }
  fmt?: (v: number) => string
  highlight?: 'lead' | 'focus'
  missingNote?: string
}) => {
  const sorted = [...items].sort((a, b) => b.value - a.value)
  const noteH = missingNote ? 16 : 0
  const top = ref ? 22 : 4
  const h = top + sorted.length * row + 4 + noteH
  const x0 = labelW
  const x1 = w - 46
  const rawMax = Math.max(...sorted.map((d) => d.value), ref ? ref.value : 0, 0)
  const M = max && max > 0 ? max : rawMax > 0 ? rawMax : 1
  const X = (v: number) => x0 + (Math.max(0, v) / M) * (x1 - x0)
  let s = svgOpen(w, h, 'Ranking')
  if (ref) {
    const xr = X(ref.value)
    s += `<line class="line-ref" x1="${f1(xr)}" x2="${f1(xr)}" y1="${top - 2}" y2="${h - 2 - noteH}"/>`
    const refAnchor = xr < x0 + 40 ? 'start' : xr > x1 - 40 ? 'end' : 'middle'
    s += `<text class="tick" x="${f1(xr)}" y="${top - 8}" text-anchor="${refAnchor}">${ref.label}</text>`
  }
  sorted.forEach((d, i) => {
    const y = top + i * row
    const strong = highlight === 'lead' ? i === 0 : !!d.focus
    const barW = Math.max(2, X(d.value) - x0)
    s += `<text class="label" x="0" y="${y + row / 2 + 4}" style="${strong ? 'fill:var(--ink);font-weight:600' : ''}">${d.label}</text>`
    s += `<rect class="${strong ? 'bar-lead' : 'bar'}" x="${x0}" y="${y + 5}" width="${f1(barW)}" height="${row - 10}" rx="1" fill="${strong ? 'var(--perf-4)' : 'var(--perf)'}"/>`
    s += `<text class="value" x="${f1(x0 + barW + 6)}" y="${y + row / 2 + 4}">${d.display || fmt(d.value)}</text>`
  })
  if (missingNote) {
    s += `<text class="annot" x="0" y="${h - 4}">${missingNote}</text>`
  }
  return s + '</svg>'
}

export const deviation = ({
  items,
  w = 330,
  row = 24,
  labelW = 118,
  span,
}: {
  items: DeviationItem[]
  w?: number
  row?: number
  labelW?: number
  span?: number
}) => {
  const sorted = [...items].sort((a, b) => b.value - a.value)
  const h = sorted.length * row + 22
  const S = span || Math.ceil(Math.max(...sorted.map((d) => Math.abs(d.value))) / 10) * 10
  const x0 = labelW + 30
  const x1 = w - 30
  const xm = (x0 + x1) / 2
  const X = (v: number) => xm + (v / S) * ((x1 - x0) / 2)
  let s = svgOpen(w, h, 'Gap to reference')
  sorted.forEach((d, i) => {
    const y = i * row
    const pos = d.value >= 0
    s += `<text class="label" x="0" y="${y + row / 2 + 4}">${d.label}</text>`
    s += `<rect class="${pos ? 'bar-lead' : 'bar'}" x="${f1(Math.min(xm, X(d.value)))}" y="${y + 6}" width="${f1(Math.abs(X(d.value) - xm))}" height="${row - 12}"/>`
    const lbl = (d.value > 0 ? '+' : d.value < 0 ? '\u2212' : '') + fr(Math.abs(d.value), 0) + PCT
    s += `<text class="value" x="${f1(pos ? X(d.value) + 5 : X(d.value) - 5)}" y="${y + row / 2 + 4}" text-anchor="${pos ? 'start' : 'end'}">${lbl}</text>`
  })
  s += `<line class="axis" x1="${xm}" x2="${xm}" y1="0" y2="${sorted.length * row}"/>`
  s += `<text class="tick" x="${xm}" y="${h - 4}" text-anchor="middle">position mean</text>`
  return s + '</svg>'
}

export const smallMultiples = ({
  panels,
  ref,
  yMin,
  yMax,
  cols = 3,
  w = 698,
  ph = 104,
  xFrom,
  xTo,
  ticks,
}: {
  panels: SmallMultiplePanel[]
  ref: number[]
  yMin: number
  yMax: number
  cols?: number
  w?: number
  ph?: number
  xFrom: string
  xTo: string
  ticks: number[]
}) => {
  const gap = 22
  const pw = (w - gap * (cols - 1)) / cols
  const rows = Math.ceil(panels.length / cols)
  const h = rows * (ph + 16)
  let s = svgOpen(w, h, 'Small multiples')
  panels.forEach((p, k) => {
    const ox = (k % cols) * (pw + gap)
    const oy = Math.floor(k / cols) * (ph + 16)
    const x0 = ox + 18
    const x1 = ox + pw - 24
    const y0 = oy + 26
    const y1 = oy + ph - 14
    const X = (i: number) => x0 + (i * (x1 - x0)) / (p.values.length - 1)
    const Y = (v: number) => y1 - ((v - yMin) / (yMax - yMin)) * (y1 - y0)
    s += `<text class="label" x="${ox}" y="${oy + 12}" style="fill:var(--ink);font-weight:600">${p.title}</text>`
    for (const tick of ticks) {
      s += `<line class="${tick === yMin ? 'axis' : 'grid'}" x1="${x0}" x2="${x1}" y1="${f1(Y(tick))}" y2="${f1(Y(tick))}"/>`
      if (k % cols === 0)
        s += `<text class="tick" x="${x0 - 5}" y="${f1(Y(tick) + 3.5)}" text-anchor="end">${tick}</text>`
    }
    s += `<polyline class="line-ref" points="${ref.map((v, i) => `${f1(X(i))},${f1(Y(v))}`).join(' ')}"/>`
    s += `<polyline fill="none" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round" points="${p.values.map((v, i) => `${f1(X(i))},${f1(Y(v))}`).join(' ')}"/>`
    const li = p.values.length - 1
    const lv = p.values[li]
    s += `<circle cx="${f1(X(li))}" cy="${f1(Y(lv))}" r="3" fill="var(--ink)"/>`
    s += `<text class="value" x="${f1(X(li) + 6)}" y="${f1(Y(lv) + 4)}">${lv}</text>`
    const iMax = p.values.indexOf(Math.max(...p.values))
    if (iMax !== li)
      s += `<text class="value" x="${f1(X(iMax))}" y="${f1(Y(p.values[iMax]) - 6)}" text-anchor="middle">${p.values[iMax]}</text>`
    s += `<text class="tick" x="${x0}" y="${oy + ph}" >${xFrom}</text><text class="tick" x="${x1}" y="${oy + ph}" text-anchor="end">${xTo}</text>`
  })
  return s + '</svg>'
}

export const scatter = ({
  points,
  w = 698,
  h = 290,
  xDom,
  yDom,
  xTicks,
  yTicks,
  xRef,
  yRef,
  xTitle,
  yTitle,
  zones = [],
}: {
  points: ScatterPoint[]
  w?: number
  h?: number
  xDom: [number, number]
  yDom: [number, number]
  xTicks: number[]
  yTicks: number[]
  xRef?: { v: number; label: string }
  yRef?: { v: number; label: string }
  xTitle: string
  yTitle: string
  zones?: Array<{ x: number; y: number; text: string; anchor?: string }>
}) => {
  const x0 = 46
  const x1 = w - 16
  const y0 = 30
  const y1 = h - 42
  const X = (v: number) => x0 + ((v - xDom[0]) / (xDom[1] - xDom[0])) * (x1 - x0)
  const Y = (v: number) => y1 - ((v - yDom[0]) / (yDom[1] - yDom[0])) * (y1 - y0)
  let s = svgOpen(w, h, 'Scatter')
  for (const tick of yTicks) {
    s += `<line class="${tick === yDom[0] ? 'axis' : 'grid'}" x1="${x0}" x2="${x1}" y1="${f1(Y(tick))}" y2="${f1(Y(tick))}"/>`
    s += `<text class="tick" x="${x0 - 8}" y="${f1(Y(tick) + 3.5)}" text-anchor="end">${tick}</text>`
  }
  for (const tick of xTicks)
    s += `<text class="tick" x="${f1(X(tick))}" y="${y1 + 16}" text-anchor="middle">${fr(tick, 1)}</text>`
  if (xRef)
    s += `<line class="line-ref" x1="${f1(X(xRef.v))}" x2="${f1(X(xRef.v))}" y1="${y0}" y2="${y1}"/><text class="tick" x="${f1(X(xRef.v) + 5)}" y="${y0 + 9}">${xRef.label}</text>`
  if (yRef)
    s += `<line class="line-ref" x1="${x0}" x2="${x1}" y1="${f1(Y(yRef.v))}" y2="${f1(Y(yRef.v))}"/><text class="tick" x="${x0 + 4}" y="${f1(Y(yRef.v) - 5)}">${yRef.label}</text>`
  for (const z of zones)
    s += `<text class="annot" x="${f1(X(z.x))}" y="${f1(Y(z.y))}" text-anchor="${z.anchor || 'start'}" style="font-weight:600;fill:var(--ink-3)">${z.text}</text>`
  for (const p of points.filter((q) => !q.focus))
    s += `<circle cx="${f1(X(p.x))}" cy="${f1(Y(p.y))}" r="4" fill="var(--reference)" stroke="var(--surface)" stroke-width="1.5"/>`
  for (const p of points.filter((q) => q.focus)) {
    const cx = X(p.x)
    const cy = Y(p.y)
    s += `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="5" fill="var(--risk)" stroke="var(--surface)" stroke-width="2"/>`
    const side = p.side || 'r'
    const pos = {
      r: [cx + 9, cy + 4, 'start'],
      l: [cx - 9, cy + 4, 'end'],
      t: [cx, cy - 10, 'middle'],
      b: [cx, cy + 17, 'middle'],
    }[side] as [number, number, string]
    s += `<text class="value" x="${f1(pos[0])}" y="${f1(pos[1])}" text-anchor="${pos[2]}">${p.label}</text>`
  }
  s += `<text class="tick" x="${x1}" y="${h - 4}" text-anchor="end">${xTitle}</text>`
  s += `<text class="tick" x="0" y="10">${yTitle}</text>`
  return s + '</svg>'
}

export const acwrChart = ({
  series,
  labels,
  w = 330,
  h = 220,
  band = [0.8, 1.3] as [number, number],
  dom = [0.6, 1.7] as [number, number],
}: {
  series: AcwrSeries[]
  labels: string[]
  w?: number
  h?: number
  band?: [number, number]
  dom?: [number, number]
}) => {
  const x0 = 30
  const x1 = w - 96
  const y0 = 12
  const y1 = h - 26
  const X = (i: number) => x0 + (i * (x1 - x0)) / (labels.length - 1)
  const Y = (v: number) => y1 - ((v - dom[0]) / (dom[1] - dom[0])) * (y1 - y0)
  let s = svgOpen(w, h, 'ACWR by week')
  s += `<rect class="band" x="${x0}" y="${f1(Y(band[1]))}" width="${x1 - x0}" height="${f1(Y(band[0]) - Y(band[1]))}"/>`
  for (const tick of [0.6, 0.8, 1.0, 1.3, 1.6])
    s += `<text class="tick" x="${x0 - 6}" y="${f1(Y(tick) + 3.5)}" text-anchor="end">${fr(tick, 1)}</text>`
  s += `<line class="axis" x1="${x0}" x2="${x1}" y1="${y1}" y2="${y1}"/>`
  labels.forEach((l, i) => {
    s += `<text class="tick" x="${f1(X(i))}" y="${y1 + 15}" text-anchor="middle">${l}</text>`
  })
  const ends: Array<{ y: number; text: string; color: string }> = []
  for (const se of series) {
    const dashed = se.ref
    s += `<polyline ${dashed ? 'class="line-ref"' : `fill="none" stroke="${se.color}" stroke-width="2" stroke-linejoin="round"`} points="${se.values.map((v, i) => `${f1(X(i))},${f1(Y(v))}`).join(' ')}"/>`
    const li = se.values.length - 1
    if (!dashed)
      s += `<circle cx="${f1(X(li))}" cy="${f1(Y(se.values[li]))}" r="3.5" fill="${se.color}" stroke="var(--surface)" stroke-width="1.5"/>`
    ends.push({
      y: Y(se.values[li]),
      text: `${se.name} ${fr(se.values[li], 2)}`,
      color: dashed ? 'var(--ink-3)' : (se.color as string),
    })
  }
  ends.sort((a, b) => a.y - b.y)
  for (let i = 1; i < ends.length; i++)
    if (ends[i].y - ends[i - 1].y < 13) ends[i].y = ends[i - 1].y + 13
  for (const e of ends)
    s += `<text class="value" x="${x1 + 8}" y="${f1(e.y + 4)}" style="fill:${e.color}">${e.text}</text>`
  return s + '</svg>'
}

export const columnsLine = ({
  labels,
  cols,
  line,
  w = 330,
  h = 220,
  max,
}: {
  labels: string[]
  cols: number[]
  line: number[]
  w?: number
  h?: number
  max?: number
  lineName?: string
  colName?: string
}) => {
  const x0 = 40
  const x1 = w - 10
  const y0 = 18
  const y1 = h - 26
  const M = max || Math.max(...cols, ...line) * 1.1
  const bw = ((x1 - x0) / labels.length) * 0.56
  const X = (i: number) => x0 + ((i + 0.5) * (x1 - x0)) / labels.length
  const Y = (v: number) => y1 - (v / M) * (y1 - y0)
  let s = svgOpen(w, h, 'Weekly load')
  for (const tick of [0, 1000, 2000, 3000].filter((v) => v <= M)) {
    s += `<line class="${tick === 0 ? 'axis' : 'grid'}" x1="${x0}" x2="${x1}" y1="${f1(Y(tick))}" y2="${f1(Y(tick))}"/>`
    s += `<text class="tick" x="${x0 - 6}" y="${f1(Y(tick) + 3.5)}" text-anchor="end">${int(tick)}</text>`
  }
  cols.forEach((v, i) => {
    const last = i === cols.length - 1
    s += `<rect class="${last ? 'bar-lead' : 'bar'}" x="${f1(X(i) - bw / 2)}" y="${f1(Y(v))}" width="${f1(bw)}" height="${f1(y1 - Y(v))}" rx="1"/>`
    s += `<text class="tick" x="${f1(X(i))}" y="${y1 + 15}" text-anchor="middle">${labels[i]}</text>`
    if (last || v === Math.max(...cols.slice(0, -1)))
      s += `<text class="value" x="${f1(X(i))}" y="${f1(Y(v) - 6)}" text-anchor="middle">${int(v)}</text>`
  })
  s += `<polyline fill="none" stroke="var(--ink-2)" stroke-width="2" points="${line.map((v, i) => `${f1(X(i))},${f1(Y(v))}`).join(' ')}"/>`
  return s + '</svg>'
}

export const stacked = ({
  labels,
  parts,
  colors,
  w = 330,
  h = 220,
  total,
}: {
  labels: string[]
  parts: number[][]
  colors: string[]
  w?: number
  h?: number
  total?: number
}) => {
  const x0 = 6
  const x1 = w - 6
  const plotTop = 8
  const y1 = h - 26
  const T = total || Math.max(...parts.map((p) => p.reduce((sum, x) => sum + x, 0)))
  const bw = ((x1 - x0) / labels.length) * 0.66
  const X = (i: number) => x0 + ((i + 0.5) * (x1 - x0)) / labels.length
  const Hh = (v: number) => (v / T) * (y1 - plotTop)
  let s = svgOpen(w, h, 'Availability by day')
  parts.forEach((p, i) => {
    let y = y1
    p.forEach((v, k) => {
      if (!v) return
      const hh = Hh(v)
      y -= hh
      s += `<rect x="${f1(X(i) - bw / 2)}" y="${f1(y + 1)}" width="${f1(bw)}" height="${f1(hh - 2)}" fill="${colors[k]}"/>`
      if (hh >= 14)
        s += `<text class="value" x="${f1(X(i))}" y="${f1(y + hh / 2 + 4)}" text-anchor="middle" style="fill:${k === 0 ? 'var(--ink)' : '#FFFFFF'}">${v}</text>`
    })
    s += `<text class="tick" x="${f1(X(i))}" y="${y1 + 15}" text-anchor="middle">${labels[i]}</text>`
  })
  return s + '</svg>'
}

export const timeline = ({
  rows,
  from,
  to,
  now,
  w = 698,
  row = 34,
  labelW = 150,
}: {
  rows: TimelineRow[]
  from: number
  to: number
  now: number
  w?: number
  row?: number
  labelW?: number
}) => {
  const top = 20
  const h = top + rows.length * row + 6
  const x0 = labelW
  const x1 = w - 8
  const X = (wk: number) => x0 + ((wk - from) / (to - from)) * (x1 - x0)
  let s = svgOpen(w, h, 'Absences by player')
  for (let wk = from; wk <= to; wk++) {
    s += `<line class="grid" x1="${f1(X(wk))}" x2="${f1(X(wk))}" y1="${top - 4}" y2="${h - 4}"/>`
    if (wk < to)
      s += `<text class="tick" x="${f1((X(wk) + X(wk + 1)) / 2)}" y="${top - 8}" text-anchor="middle">W${wk}</text>`
  }
  const xn = X(now + 0.5)
  rows.forEach((r, i) => {
    const y = top + i * row
    s += `<text class="label" x="0" y="${y + 14}" style="fill:var(--ink);font-weight:600">${r.who}</text>`
    s += `<text class="tick" x="0" y="${y + 27}">${r.what}</text>`
    const xa = X(Math.max(r.start, from))
    const xb = X(Math.min(r.end, to))
    if (r.ongoing) {
      s += `<rect x="${f1(xa)}" y="${y + 7}" width="${f1(Math.min(xn, xb) - xa)}" height="12" fill="var(--ink)"/>`
      if (xb > xn)
        s += `<rect x="${f1(xn)}" y="${y + 7.75}" width="${f1(xb - xn)}" height="10.5" fill="none" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="3 2"/>`
    } else {
      s += `<rect x="${f1(xa)}" y="${y + 7}" width="${f1(xb - xa)}" height="12" fill="var(--reference)"/>`
    }
    const fits = xb + 6 + r.phase.length * 5.6 <= w
    s += `<text class="tick" x="${f1(fits ? xb + 6 : xa - 6)}" y="${y + 17}" text-anchor="${fits ? 'start' : 'end'}">${r.phase}</text>`
  })
  s += `<line x1="${f1(xn)}" x2="${f1(xn)}" y1="${top - 4}" y2="${h - 2}" stroke="var(--accent)" stroke-width="1.5"/>`
  s += `<text class="annot" x="${f1(xn + 4)}" y="${h - 4}" style="fill:var(--accent);font-weight:600">today</text>`
  return s + '</svg>'
}

export const dotStrip = ({
  rows,
  dom,
  ticks,
  w = 698,
  row = 66,
  labelW = 110,
  note,
}: {
  rows: DotStripRow[]
  dom: [number, number]
  ticks: number[]
  w?: number
  row?: number
  labelW?: number
  note?: string
}) => {
  const x0 = labelW
  const x1 = w - 20
  const h = rows.length * row + 30
  const X = (v: number) => x0 + ((v - dom[0]) / (dom[1] - dom[0])) * (x1 - x0)
  let s = svgOpen(w, h, 'Distribution')
  rows.forEach((r, k) => {
    const yc = k * row + 36
    s += `<text class="label" x="0" y="${yc + 4}" style="fill:var(--ink);font-weight:600">${r.title}</text>`
    s += `<line class="axis" x1="${x0}" x2="${x1}" y1="${yc}" y2="${yc}"/>`
    const vals = Object.values(r.values).sort((a, b) => a - b)
    const med =
      vals.length % 2
        ? vals[vals.length >> 1]
        : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2
    s += `<line x1="${f1(X(med))}" x2="${f1(X(med))}" y1="${yc - 12}" y2="${yc + 12}" stroke="var(--ink-2)" stroke-width="1.5"/>`
    s += `<text class="tick" x="${f1(X(med))}" y="${yc + 24}" text-anchor="middle">median ${fr(med, 1)}</text>`
    const seen: Record<string, number> = {}
    for (const [label, v] of Object.entries(r.values)) {
      if (r.focus.includes(label)) continue
      const kx = v.toFixed(1)
      seen[kx] = (seen[kx] || 0) + 1
      const dy = (seen[kx] - 1) * 5 * (seen[kx] % 2 ? 1 : -1)
      s += `<circle cx="${f1(X(v))}" cy="${f1(yc + dy)}" r="4" fill="var(--reference)" fill-opacity="0.75"/>`
    }
    let prevX = -999
    let lift = 0
    ;[...r.focus]
      .sort((a, b) => r.values[a] - r.values[b])
      .forEach((label) => {
        const v = r.values[label]
        const x = X(v)
        lift = x - prevX < 95 ? lift + 12 : 0
        prevX = x
        s += `<circle cx="${f1(x)}" cy="${yc}" r="5" fill="var(--ink)" stroke="var(--surface)" stroke-width="1.5"/>`
        s += `<text class="value" x="${f1(x)}" y="${yc - 10 - lift}" text-anchor="middle">${label} ${fr(v, 1)}</text>`
      })
  })
  ticks.forEach((tick) => {
    s += `<text class="tick" x="${f1(X(tick))}" y="${h - 4}" text-anchor="middle">${tick}</text>`
  })
  if (note) s += `<text class="tick" x="${x1}" y="${h - 4}" text-anchor="end">${note}</text>`
  return s + '</svg>'
}

export const radar = ({
  axes,
  series,
  w = 360,
  h = 320,
}: {
  axes: Array<{ key: string; label: string; max?: number }>
  series: Array<{ name: string; values: number[]; focus?: boolean }>
  w?: number
  h?: number
}) => {
  const cappedAxes = axes.slice(0, 5)
  if (cappedAxes.length < 3) throw new Error('radar requires 3 to 5 axes')
  if (series.length < 1) throw new Error('radar requires one series (player or team)')
  const primary = series.find((row) => row.focus) ?? series[0]!
  const n = cappedAxes.length
  const cx = w / 2
  const cy = h / 2 + 6
  const radius = Math.min(w, h) * 0.36
  const angleAt = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n
  const point = (i: number, ratio: number) => {
    const a = angleAt(i)
    return [cx + Math.cos(a) * radius * ratio, cy + Math.sin(a) * radius * ratio] as const
  }
  let s = svgOpen(w, h, 'Radar')
  for (const ring of [0.25, 0.5, 0.75, 1]) {
    const pts = cappedAxes
      .map((_, i) => {
        const [x, y] = point(i, ring)
        return `${f1(x)},${f1(y)}`
      })
      .join(' ')
    s += `<polygon points="${pts}" fill="none" stroke="var(--line)" stroke-width="1"/>`
  }
  cappedAxes.forEach((axis, i) => {
    const [x, y] = point(i, 1)
    s += `<line x1="${f1(cx)}" y1="${f1(cy)}" x2="${f1(x)}" y2="${f1(y)}" stroke="var(--line)" stroke-width="1"/>`
    const [lx, ly] = point(i, 1.18)
    s += `<text class="label" x="${f1(lx)}" y="${f1(ly)}" text-anchor="middle" style="font-weight:600;fill:var(--ink)">${axis.label}</text>`
  })
  const poly = cappedAxes
    .map((axis, i) => {
      const max = axis.max && axis.max > 0 ? axis.max : 5
      const raw = primary.values[i] ?? 0
      const ratio = Math.max(0, Math.min(1, raw / max))
      const [x, y] = point(i, ratio)
      return `${f1(x)},${f1(y)}`
    })
    .join(' ')
  s += `<polygon points="${poly}" fill="var(--risk)" fill-opacity="0.18" stroke="var(--risk)" stroke-width="2"/>`
  cappedAxes.forEach((axis, i) => {
    const max = axis.max && axis.max > 0 ? axis.max : 5
    const raw = primary.values[i] ?? 0
    const ratio = Math.max(0, Math.min(1, raw / max))
    const [x, y] = point(i, ratio)
    s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="3.5" fill="var(--risk)" stroke="var(--surface)" stroke-width="1.5"/>`
  })
  s += `<text class="value" x="${f1(cx)}" y="${h - 8}" text-anchor="middle">${primary.name}</text>`
  return s + '</svg>'
}

export const linesBand = ({
  xLabels,
  mean: meanVals,
  min,
  max,
  w = 698,
  h = 220,
  yMin,
  yMax,
  meanName = 'Team mean',
}: {
  xLabels: string[]
  mean: number[]
  min: number[]
  max: number[]
  w?: number
  h?: number
  yMin?: number
  yMax?: number
  meanName?: string
}) => {
  if (xLabels.length < 2) throw new Error('lines_band requires at least 2 points')
  const all = [...meanVals, ...min, ...max]
  const lo = yMin ?? Math.min(...all)
  const hi = yMax ?? Math.max(...all)
  const span = hi - lo || 1
  const x0 = 40
  const x1 = w - 110
  const y0 = 24
  const y1 = h - 36
  const X = (i: number) => x0 + (i * (x1 - x0)) / (xLabels.length - 1)
  const Y = (v: number) => y1 - ((v - lo) / span) * (y1 - y0)
  let s = svgOpen(w, h, 'Team mean min-max')
  const bandPts = [
    ...max.map((v, i) => `${f1(X(i))},${f1(Y(v))}`),
    ...[...min].reverse().map((v, i) => {
      const idx = min.length - 1 - i
      return `${f1(X(idx))},${f1(Y(v))}`
    }),
  ].join(' ')
  s += `<polygon points="${bandPts}" fill="var(--reference)" fill-opacity="0.22" stroke="none"/>`
  s += `<polyline fill="none" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round" points="${meanVals.map((v, i) => `${f1(X(i))},${f1(Y(v))}`).join(' ')}"/>`
  xLabels.forEach((label, i) => {
    s += `<text class="tick" x="${f1(X(i))}" y="${y1 + 16}" text-anchor="middle">${label}</text>`
  })
  const last = meanVals[meanVals.length - 1] ?? 0
  s += `<text class="value" x="${x1 + 10}" y="${f1(Y(last) + 4)}">${meanName} ${fr(last, 1)}</text>`
  return s + '</svg>'
}

export const riskClass = (v: number) =>
  v >= 75 ? 'r4' : v >= 50 ? 'r3' : v >= 25 ? 'r2' : v >= 10 ? 'r1' : 'r0'

export const perfClass = (v: number) =>
  v >= 65 ? 'p4' : v >= 55 ? 'p3' : v >= 45 ? 'p2' : v >= 35 ? 'p1' : 'p0'
