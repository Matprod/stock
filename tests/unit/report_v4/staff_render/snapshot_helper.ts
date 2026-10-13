import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = join(dirname(fileURLToPath(import.meta.url)), '__snapshots__')

export const assertHtmlSnapshot = (
  assert: { equal: (a: unknown, b: unknown, message?: string) => void },
  name: string,
  html: string
): void => {
  mkdirSync(dir, { recursive: true })
  const path = join(dir, `${name}.html`)
  const normalized = `${html.trim()}\n`
  if (process.env.UPDATE_STAFF_SNAPSHOTS === '1' || !existsSync(path)) {
    writeFileSync(path, normalized, 'utf8')
  }
  const expected = readFileSync(path, 'utf8')
  assert.equal(normalized, expected, `snapshot mismatch: ${name}`)
}
