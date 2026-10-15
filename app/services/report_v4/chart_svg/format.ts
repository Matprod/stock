const NB = '\u00a0'

export const PCT = '%'

export const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length

export const f1 = (x: number) => x.toFixed(1)

export const fr = (x: number, d = 1) => x.toFixed(d)

export const int = (x: number) =>
  Math.round(x)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')

export const dayShort = (n: number) => `${n}${NB}Mar`

export const svgOpen = (w: number, h: number, label: string) =>
  `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">`

export const stampChart = (markup: string, datasetId: string, type: string) => {
  const attr = `data-chart="${datasetId}:${type}"`
  if (markup.startsWith('<svg ')) return markup.replace('<svg ', `<svg ${attr} `)
  if (markup.startsWith('<div ')) return markup.replace('<div ', `<div ${attr} `)
  return markup
}
