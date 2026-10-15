import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ReportDesignPackId } from '#services/report_v4/design/report_design_pack'

const require = createRequire(import.meta.url)
const fontsDir = join(dirname(fileURLToPath(import.meta.url)), 'assets', 'fonts')

export const REPORT_V4_ECHARTS_ASSET_PATH = '/reports/report-v4/assets/echarts.min.js'

let echartsCache: string | null = null

export const loadEchartsMinJs = (): string => {
  if (echartsCache) return echartsCache
  const resolved = require.resolve('echarts/dist/echarts.min.js')
  echartsCache = readFileSync(resolved, 'utf8')
  return echartsCache
}

const fontDataUri = (filename: string): string => {
  const buf = readFileSync(join(fontsDir, filename))
  return `url(data:font/woff2;base64,${buf.toString('base64')})`
}

const face = (family: string, weight: number, file: string): string =>
  `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:${fontDataUri(file)} format('woff2');}`

export const buildPackFontFaceCss = (packId: ReportDesignPackId): string => {
  if (packId === 'clinical') {
    return [
      face('Source Sans 3', 400, 'source-sans-3-latin-400.woff2'),
      face('Source Sans 3', 600, 'source-sans-3-latin-600.woff2'),
      face('Source Sans 3', 700, 'source-sans-3-latin-700.woff2'),
    ].join('')
  }
  if (packId === 'editorial') {
    return [
      face('Libre Franklin', 400, 'libre-franklin-latin-400.woff2'),
      face('Libre Franklin', 600, 'libre-franklin-latin-600.woff2'),
      face('Libre Franklin', 700, 'libre-franklin-latin-700.woff2'),
    ].join('')
  }
  return [
    face('IBM Plex Sans', 400, 'ibm-plex-sans-latin.woff2'),
    face('IBM Plex Sans', 500, 'ibm-plex-sans-latin-500.woff2'),
    face('IBM Plex Sans', 600, 'ibm-plex-sans-latin-600.woff2'),
    face('IBM Plex Sans', 700, 'ibm-plex-sans-latin-700.woff2'),
    face('IBM Plex Sans Condensed', 600, 'ibm-plex-sans-condensed-latin-600.woff2'),
    face('IBM Plex Sans Condensed', 700, 'ibm-plex-sans-condensed-latin-700.woff2'),
  ].join('')
}

export const packFontsStyleTag = (packId: ReportDesignPackId): string =>
  `<style id="mauna-pack-fonts" data-pack="${packId}">${buildPackFontFaceCss(packId)}</style>`

export const echartsLocalScriptTag = (): string =>
  `<script id="mauna-echarts" src="${REPORT_V4_ECHARTS_ASSET_PATH}" onload="window.__maunaEchartsLoaded=1;window.__maunaOnEchartsLoad&&window.__maunaOnEchartsLoad()"></script>`
