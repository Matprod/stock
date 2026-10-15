import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { designKitPath } from '#services/report_v4/free_designer/kit_paths'
import {
  collectLayoutWarningsInPage,
  type LayoutWarning,
} from '#services/report_v4/free_designer/layout_checks_page'

export type { LayoutWarning, LayoutWarningCode } from '#services/report_v4/free_designer/layout_checks_page'

const A4_VIEWPORT = { width: 794, height: 1123 }
const LAYOUT_TIMEOUT_MS = 15_000
const MIN_FONT_PX = 10.5
const MIN_FILL_RATIO = 0.7

const expandHex = (hex: string): string => {
  const raw = hex.replace('#', '').toLowerCase()
  if (raw.length === 3 || raw.length === 4) {
    return raw
      .slice(0, 3)
      .split('')
      .map((ch) => `${ch}${ch}`)
      .join('')
  }
  return raw.slice(0, 6)
}

const hexToRgbKey = (hex: string): string => {
  const full = expandHex(hex)
  const n = Number.parseInt(full, 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}

export const extractThemeRgbKeys = (themeCss: string): string[] => {
  const keys = new Set<string>()
  const hexRe = /#([0-9a-fA-F]{3,8})\b/g
  let match: RegExpExecArray | null
  while ((match = hexRe.exec(themeCss))) {
    keys.add(hexToRgbKey(match[0]))
  }
  return [...keys]
}

export const loadThemeRgbKeys = (): string[] => {
  const css = readFileSync(designKitPath('theme.css'), 'utf8')
  return extractThemeRgbKeys(css)
}

export type RunLayoutChecksOnPagesArgs = {
  pageBlockIds?: string[]
}

export const runLayoutChecksOnPages = async (
  html: string,
  opts: RunLayoutChecksOnPagesArgs = {}
): Promise<{ warnings: LayoutWarning[] }> => {
  const themeRgbKeys = loadThemeRgbKeys()
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })
  try {
    const page = await browser.newPage({
      viewport: A4_VIEWPORT,
      deviceScaleFactor: 1,
    })
    page.setDefaultTimeout(LAYOUT_TIMEOUT_MS)
    page.setDefaultNavigationTimeout(LAYOUT_TIMEOUT_MS)
    await page.emulateMedia({ media: 'print' })
    await page.setContent(html, { waitUntil: 'load', timeout: LAYOUT_TIMEOUT_MS })
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready
    })
    const warnings = await page.evaluate(
      ({ fnSource, checkArgs }) => {
        const fn = new Function(`return (${fnSource})`)() as (
          a: typeof checkArgs
        ) => LayoutWarning[]
        return fn(checkArgs)
      },
      {
        fnSource: collectLayoutWarningsInPage.toString(),
        checkArgs: {
          pageBlockIds: opts.pageBlockIds ?? null,
          themeRgbKeys,
          minFontPx: MIN_FONT_PX,
          minFillRatio: MIN_FILL_RATIO,
        },
      }
    )
    return { warnings }
  } finally {
    await browser.close()
  }
}
