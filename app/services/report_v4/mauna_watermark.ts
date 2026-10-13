import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BlendMode,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRef,
} from 'pdf-lib'

const WATERMARK_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../report_builder/pdf/rapport-watermark-a4.png'
)

let cachedDataUri: string | undefined
let cachedPngBytes: Uint8Array | undefined

const maunaWatermarkDataUri = (): string => {
  if (!cachedDataUri) {
    cachedDataUri = `data:image/png;base64,${readFileSync(WATERMARK_PATH).toString('base64')}`
  }
  return cachedDataUri
}

const maunaWatermarkPngBytes = (): Uint8Array => {
  if (!cachedPngBytes) {
    cachedPngBytes = new Uint8Array(readFileSync(WATERMARK_PATH))
  }
  return cachedPngBytes
}

export const maunaWatermarkCss = (): string => `
.mauna-page-watermark {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  object-fit: fill;
  pointer-events: none;
  z-index: 0;
}
.page, .report-flow, .artifact-shell {
  position: relative;
  z-index: 1;
}
@media print {
  .mauna-page-watermark { display: none !important; }
}
`

export const maunaWatermarkImgTag = (): string =>
  `<img class="mauna-page-watermark" src="${maunaWatermarkDataUri()}" alt="" aria-hidden="true" />`

type NamedDest = {
  pageRef: PDFRef
  left: PDFNumber
  top: PDFNumber
  zoom: PDFNumber
}

const asPdfNumber = (value: unknown, fallback: number): PDFNumber =>
  value instanceof PDFNumber ? value : PDFNumber.of(fallback)

const readDestArray = (arr: PDFArray): NamedDest | null => {
  if (arr.size() < 1) return null
  const pageRef = arr.get(0)
  if (!(pageRef instanceof PDFRef)) return null
  return {
    pageRef,
    left: asPdfNumber(arr.lookup(2), 0),
    top: asPdfNumber(arr.lookup(3), 0),
    zoom: asPdfNumber(arr.lookup(4), 0),
  }
}

const catalogNamedDests = (doc: PDFDocument): Map<string, NamedDest> => {
  const out = new Map<string, NamedDest>()
  const dests = doc.catalog.lookupMaybe(PDFName.of('Dests'), PDFDict)
  if (!dests) return out
  for (const key of dests.keys()) {
    const value = dests.lookup(key)
    if (!(value instanceof PDFArray)) continue
    const parsed = readDestArray(value)
    if (parsed) out.set(key.toString(), parsed)
  }
  return out
}

const resolveLinkDest = (
  annot: PDFDict,
  named: Map<string, NamedDest>
): NamedDest | null => {
  const dest = annot.get(PDFName.of('Dest'))
  if (dest instanceof PDFArray) return readDestArray(dest)
  if (dest) return named.get(dest.toString()) ?? null

  const action = annot.lookupMaybe(PDFName.of('A'), PDFDict)
  if (!action) return null
  const destArr = action.lookupMaybe(PDFName.of('D'), PDFArray)
  return destArr ? readDestArray(destArr) : null
}

const rewriteInternalLinksToExplicitGoTo = (doc: PDFDocument): void => {
  const named = catalogNamedDests(doc)
  const context = doc.context
  for (const page of doc.getPages()) {
    const annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray)
    if (!annots) continue
    for (let i = 0; i < annots.size(); i += 1) {
      const annot = annots.lookup(i, PDFDict)
      if (annot.get(PDFName.of('Subtype'))?.toString() !== '/Link') continue
      const target = resolveLinkDest(annot, named)
      if (!target) continue
      annot.set(
        PDFName.of('A'),
        context.obj({
          Type: 'Action',
          S: 'GoTo',
          D: context.obj([
            target.pageRef,
            PDFName.of('XYZ'),
            target.left,
            target.top,
            target.zoom,
          ]),
        })
      )
      annot.delete(PDFName.of('Dest'))
    }
  }
}

export const stampMaunaWatermarkOnPdf = async (pdfBytes: Buffer): Promise<Buffer> => {
  const doc = await PDFDocument.load(pdfBytes)
  rewriteInternalLinksToExplicitGoTo(doc)
  const watermark = await doc.embedPng(maunaWatermarkPngBytes())
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize()
    page.drawImage(watermark, {
      x: 0,
      y: 0,
      width,
      height,
      opacity: 1,
      blendMode: BlendMode.Multiply,
    })
  }
  const out = await doc.save({ useObjectStreams: false })
  return Buffer.from(out)
}
