import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const fontsDir = join(dirname(fileURLToPath(import.meta.url)), '../../../../Barlowfont')

const fontDataUri = (filename: string): string => {
  const buf = readFileSync(join(fontsDir, filename))
  return `url(data:font/woff2;base64,${buf.toString('base64')})`
}

const face = (family: string, weight: number, file: string): string =>
  `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:${fontDataUri(file)} format('woff2');}`

export const buildStaffBarlowFontFaceCss = (): string =>
  [
    face('Barlow', 400, 'Barlow-Regular.woff2'),
    face('Barlow', 500, 'Barlow-Medium.woff2'),
    face('Barlow', 600, 'Barlow-SemiBold.woff2'),
    face('Barlow Condensed', 500, 'BarlowCondensed-Medium.woff2'),
    face('Barlow Condensed', 600, 'BarlowCondensed-SemiBold.woff2'),
    face('Barlow Condensed', 700, 'BarlowCondensed-Bold.woff2'),
  ].join('')
