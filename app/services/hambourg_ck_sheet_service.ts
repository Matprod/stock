import {
  CK_SHEET_DIR,
  CK_SHEET_FILE_PREFIX,
  CK_SHEET_FROM,
  CK_SHEET_NAME,
  HAMBOURG_CLUB_ID,
} from '#constants/hambourg.constants'
import Athlete from '#models_pg/athlete'
import Biomarker from '#models_pg/biomarker'
import BiomarkerType from '#models_pg/biomarker_type'
import ExcelJS from 'exceljs'
import { DateTime } from 'luxon'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

const CK_BIOMARKER_NAME = 'ck'

const CK_LAST_ALIASES: Record<string, string> = {
  groenbaek: 'gronbaek',
  'el ouahda': 'el ouahdi',
}

type PlainCell = string | number | Date | null

type PendingCk = {
  athleteId: string
  name: string
  value: string
  measuredAt: string
}

export type CkSheetImportResult = {
  dryRun: boolean
  file: string
  from: string
  created: number
  updated: number
  unchanged: number
  missing: string[]
  ambiguous: string[]
}

const foldName = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ø/gi, 'o')
    .replace(/æ/gi, 'ae')
    .replace(/œ/gi, 'oe')
    .replace(/ł/gi, 'l')
    .replace(/đ/gi, 'd')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const cellToPlain = (value: ExcelJS.CellValue): PlainCell => {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value
  if (typeof value === 'number' || typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 1 : 0

  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text
    if ('result' in value) {
      const result = value.result
      if (result === null || result === undefined) return null
      if (result instanceof Date) return result
      if (typeof result === 'number' || typeof result === 'string') return result
      return String(result)
    }
  }

  return String(value)
}

const parseDate = (value: PlainCell): string | null => {
  if (value === null || value === '') return null

  if (value instanceof Date) {
    const parsed = DateTime.fromObject(
      { year: value.getFullYear(), month: value.getMonth() + 1, day: value.getDate() },
      { zone: 'utc' }
    )
    return parsed.isValid ? parsed.toISODate() : null
  }

  if (typeof value === 'number') {
    const parsed = DateTime.fromObject({ year: 1899, month: 12, day: 30 }, { zone: 'utc' }).plus({
      days: value,
    })
    return parsed.isValid ? parsed.toISODate() : null
  }

  const isoDay = value.trim().match(/^(\d{4}-\d{2}-\d{2})/)
  if (!isoDay) return null
  const parsed = DateTime.fromISO(isoDay[1], { zone: 'utc' })
  return parsed.isValid ? parsed.toISODate() : null
}

const parseCk = (value: PlainCell): string | null => {
  if (value === null || value instanceof Date) return null
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return String(value)
  }
  const text = value.trim().replace(',', '.')
  if (!text) return null
  const parsed = Number(text)
  if (!Number.isFinite(parsed)) return null
  return String(parsed)
}

const isZero = (value: string): boolean => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed === 0
}

const preferValue = (current: string | undefined, incoming: string): string => {
  if (current === undefined) return incoming
  if (isZero(current) && !isZero(incoming)) return incoming
  if (!isZero(current) && isZero(incoming)) return current
  return incoming
}

const uniqueAthlete = (athletes: Athlete[]): Athlete | 'ambiguous' | null => {
  const ids = [...new Set(athletes.map((athlete) => athlete.id))]
  if (ids.length === 1) return athletes.find((athlete) => athlete.id === ids[0]) ?? null
  if (ids.length > 1) return 'ambiguous'
  return null
}

const resolveFile = async (file?: string): Promise<string> => {
  if (file) return file
  const names = await readdir(CK_SHEET_DIR)
  const match = names.find((name) => name.startsWith(CK_SHEET_FILE_PREFIX) && name.endsWith('.xlsx'))
  if (!match) throw new Error(`No ${CK_SHEET_FILE_PREFIX}*.xlsx in ${CK_SHEET_DIR}`)
  return join(CK_SHEET_DIR, match)
}

const headerIndex = (headers: string[], label: string): number =>
  headers.findIndex((header) => header.replace(/\s+/g, ' ').trim().toLowerCase() === label)

export default class HambourgCkSheetService {
  async importFile(options: { file?: string; from?: string; dryRun?: boolean }): Promise<CkSheetImportResult> {
    const dryRun = options.dryRun === true
    const from = options.from ?? CK_SHEET_FROM
    const fromDate = DateTime.fromISO(from, { zone: 'utc' })
    if (!fromDate.isValid) throw new Error(`Invalid from date ${from}`)

    const file = await resolveFile(options.file)
    const ckType = await BiomarkerType.findBy('name', CK_BIOMARKER_NAME)
    if (!ckType) throw new Error('Missing biomarker type ck')

    const athletes = await Athlete.query().where('clubId', HAMBOURG_CLUB_ID)
    const byLast = new Map<string, Athlete[]>()
    const byToken = new Map<string, Athlete[]>()
    const add = (map: Map<string, Athlete[]>, key: string, athlete: Athlete) => {
      if (!key) return
      const list = map.get(key) ?? []
      list.push(athlete)
      map.set(key, list)
    }
    for (const athlete of athletes) {
      const last = foldName(athlete.lastName)
      add(byLast, last, athlete)
      const token = last.split(' ').at(-1) ?? ''
      if (token && token !== last) add(byToken, token, athlete)
    }

    const matchName = (raw: string): Athlete | 'missing' | 'ambiguous' => {
      const folded = CK_LAST_ALIASES[foldName(raw)] ?? foldName(raw)
      const last = uniqueAthlete(byLast.get(folded) ?? [])
      if (last === 'ambiguous') return 'ambiguous'
      if (last) return last
      const token = uniqueAthlete(byToken.get(folded) ?? [])
      if (token === 'ambiguous') return 'ambiguous'
      if (token) return token
      return 'missing'
    }

    const reader = new ExcelJS.stream.xlsx.WorkbookReader(file, {
      worksheets: 'emit',
      sharedStrings: 'cache',
      hyperlinks: 'ignore',
      styles: 'ignore',
    })

    const pending = new Map<string, PendingCk>()
    const missing = new Set<string>()
    const ambiguous = new Set<string>()
    let sheetFound = false

    for await (const worksheet of reader) {
      const meta = worksheet as unknown as { name: string }
      if (meta.name !== CK_SHEET_NAME) continue
      sheetFound = true
      let nameCol = -1
      let dateCol = -1
      let ckCol = -1

      for await (const row of worksheet) {
        const values = ((row.values as ExcelJS.CellValue[] | undefined) ?? []).slice(1).map(cellToPlain)
        if (row.number === 1) {
          const headers = values.map((value) => (value === null || value instanceof Date ? '' : String(value)))
          dateCol = headerIndex(headers, 'datum')
          nameCol = headerIndex(headers, 'name')
          ckCol = headers.findIndex((header) => {
            const normalized = header.replace(/\s+/g, ' ').trim().toLowerCase()
            return normalized === 'ck- wert' || normalized === 'ck-wert'
          })
          if (dateCol < 0 || nameCol < 0 || ckCol < 0) {
            throw new Error('CK sheet is missing Datum, Name or CK-Wert')
          }
          continue
        }

        const measuredAt = parseDate(values[dateCol] ?? null)
        if (!measuredAt || measuredAt < from) continue
        const name = values[nameCol]
        const label = name === null || name instanceof Date ? '' : String(name).trim()
        const ck = parseCk(values[ckCol] ?? null)
        if (!label || !ck) continue

        const athlete = matchName(label)
        if (athlete === 'missing') {
          missing.add(label)
          continue
        }
        if (athlete === 'ambiguous') {
          ambiguous.add(label)
          continue
        }

        const key = `${athlete.id}|${measuredAt}`
        const current = pending.get(key)
        pending.set(key, {
          athleteId: athlete.id,
          name: label,
          value: preferValue(current?.value, ck),
          measuredAt,
        })
      }
      break
    }

    if (!sheetFound) throw new Error(`Sheet ${CK_SHEET_NAME} not found in ${file}`)

    const athleteIds = [...new Set([...pending.values()].map((row) => row.athleteId))]
    const existing =
      athleteIds.length === 0
        ? []
        : await Biomarker.query()
            .where('biomarkerTypeId', ckType.id)
            .whereIn('athleteId', athleteIds)
            .where('measuredAt', '>=', fromDate.toJSDate())

    const existingByKey = new Map<string, Biomarker>()
    for (const row of existing) {
      const day = row.measuredAt.setZone('utc').toISODate()
      if (!day) continue
      existingByKey.set(`${row.athleteId}|${day}`, row)
    }

    let created = 0
    let updated = 0
    let unchanged = 0

    for (const row of pending.values()) {
      const current = existingByKey.get(`${row.athleteId}|${row.measuredAt}`)
      if (!current) {
        created++
        if (!dryRun) {
          await Biomarker.create({
            athleteId: row.athleteId,
            biomarkerTypeId: ckType.id,
            value: row.value,
            measuredAt: DateTime.fromISO(row.measuredAt, { zone: 'utc' }),
          })
        }
        continue
      }

      const next = preferValue(current.value, row.value)
      if (next === current.value) {
        unchanged++
        continue
      }

      updated++
      if (!dryRun) {
        current.value = next
        await current.save()
      }
    }

    return {
      dryRun,
      file,
      from,
      created,
      updated,
      unchanged,
      missing: [...missing].sort(),
      ambiguous: [...ambiguous].sort(),
    }
  }
}
