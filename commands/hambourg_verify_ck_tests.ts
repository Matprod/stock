import { ATHLETE_PROVIDER_TYPES } from '#constants/athlete_provider.constants'
import { CK_TESTS_FILE, CK_TESTS_SHEET, HAMBOURG_CLUB_ID } from '#constants/hambourg.constants'
import AthleteProvider from '#models_pg/athlete_provider'
import BiomarkerType from '#models_pg/biomarker_type'
import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'
import ExcelJS from 'exceljs'
import { DateTime } from 'luxon'

const CK_BIOMARKER_NAME = 'ck'

function excelSerialToDateTime(serial: number): DateTime {
  return DateTime.fromObject({ year: 1899, month: 12, day: 30 }, { zone: 'utc' }).plus({
    days: serial,
  })
}

function cellToPlain(value: ExcelJS.CellValue): string | number | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'number' || typeof value === 'string') return value
  if (typeof value === 'object' && 'result' in value) {
    return cellToPlain(value.result as ExcelJS.CellValue)
  }
  return String(value)
}

function parseDateValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) {
    return DateTime.fromJSDate(value, { zone: 'utc' }).startOf('day').toISODate()
  }
  if (typeof value === 'number') {
    return excelSerialToDateTime(value).startOf('day').toISODate()
  }
  const text = String(value).trim()
  const fromIso = DateTime.fromISO(text, { zone: 'utc' })
  return fromIso.isValid ? fromIso.startOf('day').toISODate() : null
}

function isZero(v: string): boolean {
  const n = Number(v)
  return Number.isFinite(n) && n === 0
}

function prefer(current: string | undefined, incoming: string): string {
  if (current === undefined) return incoming
  if (isZero(current) && !isZero(incoming)) return incoming
  if (!isZero(current) && isZero(incoming)) return current
  return incoming
}

function valuesEqual(a: string, b: string): boolean {
  if (a === b) return true
  const an = Number(a)
  const bn = Number(b)
  return Number.isFinite(an) && Number.isFinite(bn) && Math.abs(an - bn) < 1e-9
}

function normalizeHeader(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase()
}

function isCkSheet(headers: string[]): boolean {
  const normalized = headers.map(normalizeHeader)
  return normalized.includes('personid') && normalized.some((h) => h === 'ck- wert' || h === 'ck-wert')
}

export default class HambourgVerifyCkTests extends BaseCommand {
  static commandName = 'hambourg:verify-ck-tests'
  static description = 'Verify CK biomarkers in DB vs ck_tests.xlsx'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const ckType = await BiomarkerType.findBy('name', CK_BIOMARKER_NAME)
    if (!ckType) {
      this.logger.error('biomarker type ck not found')
      this.exitCode = 1
      return
    }

    const providers = await AthleteProvider.query()
      .where('provider', ATHLETE_PROVIDER_TYPES.SAP)
      .whereNotNull('providerAthleteId')
      .preload('athlete', (q) => q.where('clubId', HAMBOURG_CLUB_ID))

    const athleteByPerson = new Map<string, string>()
    for (const p of providers) {
      if (!p.providerAthleteId || !p.athlete) continue
      athleteByPerson.set(p.providerAthleteId.trim().toUpperCase(), p.athlete.id)
    }

    const expected = new Map<string, string>()
    let sheetFound = false

    const reader = new ExcelJS.stream.xlsx.WorkbookReader(CK_TESTS_FILE, {
      worksheets: 'emit',
      sharedStrings: 'cache',
      hyperlinks: 'ignore',
      styles: 'ignore',
    })

    for await (const worksheet of reader) {
      const worksheetMeta = worksheet as unknown as { name: string; id: string }
      let headers: string[] = []
      let personCol = -1
      let ckCol = -1
      let dateCol = -1
      let isTargetSheet = false

      for await (const row of worksheet) {
        const vals = (row.values as ExcelJS.CellValue[] | undefined)?.slice(1) ?? []

        if (row.number === 1) {
          headers = vals.map((v) => String(cellToPlain(v) ?? '').trim())
          isTargetSheet =
            worksheetMeta.name === CK_TESTS_SHEET ||
            worksheetMeta.id === '2' ||
            isCkSheet(headers)
          if (!isTargetSheet) break

          sheetFound = true
          personCol = headers.findIndex((h) => normalizeHeader(h) === 'personid')
          ckCol = headers.findIndex((h) => {
            const n = normalizeHeader(h)
            return n === 'ck- wert' || n === 'ck-wert'
          })
          dateCol = headers.findIndex((h) => normalizeHeader(h) === 'datum')
          continue
        }

        if (!isTargetSheet) continue

        const personRaw = cellToPlain(vals[personCol])
        if (!personRaw) continue

        const ckRaw = cellToPlain(vals[ckCol])
        if (ckRaw === null || ckRaw === undefined || ckRaw === '') continue

        const date = parseDateValue(cellToPlain(vals[dateCol]))
        if (!date) continue

        const personId = String(personRaw).trim().toUpperCase()
        if (!athleteByPerson.has(personId)) continue

        const key = `${personId}|${date}`
        expected.set(key, prefer(expected.get(key), String(ckRaw)))
      }

      if (isTargetSheet) break
    }

    if (!sheetFound) {
      this.logger.error('CK sheet not found')
      this.exitCode = 1
      return
    }

    const athleteIds = [...new Set([...athleteByPerson.values()])]
    const dbRows = await db
      .from('biomarkers')
      .whereIn('athlete_id', athleteIds)
      .where('biomarker_type_id', ckType.id)
      .select('athlete_id', 'value', 'measured_at')

    const athleteToPerson = new Map(
      [...athleteByPerson].map(([personId, athleteId]) => [athleteId, personId])
    )

    const dbMap = new Map<string, string>()
    for (const row of dbRows) {
      const personId = athleteToPerson.get(row.athlete_id)
      if (!personId) continue
      const date = DateTime.fromJSDate(new Date(row.measured_at), { zone: 'utc' }).toISODate()!
      const key = `${personId}|${date}`
      dbMap.set(key, prefer(dbMap.get(key), String(row.value)))
    }

    let ok = 0
    let missing = 0
    let mismatch = 0
    const issueSamples: Array<{ key: string; expected: string; db: string }> = []

    for (const [key, exp] of expected) {
      const dbVal = dbMap.get(key)
      if (dbVal === undefined) {
        missing++
        if (issueSamples.length < 10) issueSamples.push({ key, expected: exp, db: 'MISSING' })
        continue
      }
      if (valuesEqual(exp, dbVal)) ok++
      else {
        mismatch++
        if (issueSamples.length < 10) issueSamples.push({ key, expected: exp, db: dbVal })
      }
    }

    const extraInDb = [...dbMap.keys()].filter((k) => !expected.has(k)).length

    this.logger.info('--- Summary ---')
    this.logger.info(`Expected from ck_tests.xlsx (with SAP athlete): ${expected.size}`)
    this.logger.info(`CK biomarkers in DB (Hamburg athletes): ${dbMap.size}`)
    this.logger.info(`Match: ${ok}`)
    this.logger.info(`Missing in DB: ${missing}`)
    this.logger.info(`Mismatch: ${mismatch}`)
    this.logger.info(`Extra in DB (not from ck_tests file): ${extraInDb}`)

    if (issueSamples.length > 0) {
      this.logger.warning('Samples:')
      for (const s of issueSamples) {
        this.logger.warning(`  ${s.key} expected=${s.expected} db=${s.db}`)
      }
    }

    if (missing > 0 || mismatch > 0) {
      this.exitCode = 1
      this.logger.error('CK verification failed — run: node ace hambourg:import-ck-tests')
    } else if (expected.size === 0) {
      this.exitCode = 1
      this.logger.error('No expected values found')
    } else {
      this.logger.success('All ck_tests.xlsx values are present and correct in DB')
    }
  }
}
