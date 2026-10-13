import { ATHLETE_PROVIDER_TYPES } from '#constants/athlete_provider.constants'
import { DIAGNOSTIK_BIOMARKER_DEFS } from '#constants/diagnostik.constants'
import {
  DIAGNOSTIK_FILE,
  DIAGNOSTIK_SHEET,
  HAMBOURG_CLUB_ID,
} from '#constants/hambourg.constants'
import AthleteProvider from '#models_pg/athlete_provider'
import BiomarkerType from '#models_pg/biomarker_type'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'
import ExcelJS from 'exceljs'
import { DateTime } from 'luxon'

function excelSerialToDateTime(serial: number): DateTime {
  return DateTime.fromObject({ year: 1899, month: 12, day: 30 }, { zone: 'utc' }).plus({
    days: serial,
  })
}

function cellToPlain(value: ExcelJS.CellValue): string | number | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'number' || typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 1 : 0

  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text
    if ('result' in value) {
      const result = value.result
      if (result === null || result === undefined) return null
      if (typeof result === 'number' || typeof result === 'string') return result
      if (result instanceof Date) return result.toISOString()
      return String(result)
    }
  }

  return String(value)
}

function parseDateValue(value: unknown): DateTime | null {
  if (value === null || value === undefined || value === '') return null

  if (value instanceof Date) {
    const parsed = DateTime.fromJSDate(value, { zone: 'utc' }).startOf('day')
    return parsed.isValid ? parsed : null
  }

  if (typeof value === 'number') {
    const parsed = excelSerialToDateTime(value).startOf('day')
    return parsed.isValid ? parsed : null
  }

  const text = String(value).trim()
  if (!text) return null

  const fromIso = DateTime.fromISO(text, { zone: 'utc' })
  if (fromIso.isValid) return fromIso.startOf('day')

  const fromSql = DateTime.fromSQL(text, { zone: 'utc' })
  if (fromSql.isValid) return fromSql.startOf('day')

  const jsDate = new Date(text)
  if (!Number.isNaN(jsDate.getTime())) {
    return DateTime.fromJSDate(jsDate, { zone: 'utc' }).startOf('day')
  }

  return null
}

function valueToString(value: string | number | null): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return String(value)
  }
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

function isNumericZero(value: string): boolean {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed === 0
}

/** Prefer a real measurement over a same-day filler 0. */
function preferBiomarkerValue(current: string | undefined, incoming: string): string {
  if (current === undefined) return incoming
  if (isNumericZero(current) && !isNumericZero(incoming)) return incoming
  if (!isNumericZero(current) && isNumericZero(incoming)) return current
  return incoming
}

function cacheKey(athleteId: string, typeId: string, measuredAtIso: string): string {
  return `${athleteId}|${typeId}|${measuredAtIso}`
}

export default class HambourgImportDiagnostik extends BaseCommand {
  static commandName = 'hambourg:import-diagnostik'
  static description =
    'Import Hamburg diagnostik.xlsx biomarkers (SAP PersonId → athlete, Date → measuredAt)'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({ description: 'Path to diagnostik xlsx', default: DIAGNOSTIK_FILE })
  declare file: string

  @flags.boolean({ description: 'Parse only, do not write biomarkers' })
  declare dryRun: boolean

  @flags.number({ description: 'Max rows to process (0 = all)', default: 0 })
  declare limit: number

  async run() {
    const typeNames = [...new Set(Object.values(DIAGNOSTIK_BIOMARKER_DEFS).map((d) => d.name))]
    const types = await BiomarkerType.query().whereIn('name', typeNames)
    const typeByName = new Map(types.map((type) => [type.name, type]))

    const missingTypes = typeNames.filter((name) => !typeByName.has(name))
    if (missingTypes.length > 0) {
      this.logger.error(
        `Missing biomarker types (${missingTypes.length}). Run: node ace hambourg:seed-biomarker-types`
      )
      this.logger.error(missingTypes.slice(0, 20).join(', '))
      this.exitCode = 1
      return
    }

    const providers = await AthleteProvider.query()
      .where('provider', ATHLETE_PROVIDER_TYPES.SAP)
      .whereNotNull('providerAthleteId')
      .preload('athlete', (athleteQuery) => {
        athleteQuery.where('clubId', HAMBOURG_CLUB_ID)
      })

    const athleteByPersonId = new Map<string, string>()
    for (const provider of providers) {
      if (!provider.providerAthleteId || !provider.athlete) continue
      athleteByPersonId.set(provider.providerAthleteId.trim().toUpperCase(), provider.athlete.id)
    }

    this.logger.info(`SAP athletes loaded: ${athleteByPersonId.size}`)

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(this.file)
    const sheet = workbook.getWorksheet(DIAGNOSTIK_SHEET) ?? workbook.worksheets[0] ?? null

    if (!sheet) {
      this.logger.error('No worksheet found in file')
      this.exitCode = 1
      return
    }

    const headerRow = sheet.getRow(1)
    const headerByCol = new Map<number, string>()
    headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
      const header = String(cell.value ?? '').trim()
      if (header) headerByCol.set(col, header)
    })

    const personIdCol = [...headerByCol.entries()].find(([, h]) => h === 'PersonId')?.[0]
    const dateCol = [...headerByCol.entries()].find(([, h]) => h === 'Date')?.[0]

    if (!personIdCol || !dateCol) {
      this.logger.error('Required columns PersonId and/or Date not found')
      this.exitCode = 1
      return
    }

    const metricCols: Array<{ col: number; typeId: string }> = []
    for (const [col, header] of headerByCol) {
      const def = DIAGNOSTIK_BIOMARKER_DEFS[header]
      if (!def) continue
      const type = typeByName.get(def.name)
      if (!type) continue
      metricCols.push({ col, typeId: type.id })
    }

    this.logger.info(
      `Mapped columns: ${metricCols.length}/${Object.keys(DIAGNOSTIK_BIOMARKER_DEFS).length}`
    )

    type PendingValue = {
      athleteId: string
      biomarkerTypeId: string
      value: string
      measuredAt: string
    }

    const pendingByKey = new Map<string, PendingValue>()
    let skippedEmptyPerson = 0
    let skippedMissingAthlete = 0
    let skippedMissingDate = 0
    let rowsAccepted = 0
    const missingAthleteIds = new Set<string>()

    const maxRow = this.limit > 0 ? Math.min(sheet.rowCount, 1 + this.limit) : sheet.rowCount

    for (let rowNumber = 2; rowNumber <= maxRow; rowNumber++) {
      const row = sheet.getRow(rowNumber)
      const personRaw = cellToPlain(row.getCell(personIdCol).value)
      if (personRaw === null || personRaw === '') {
        skippedEmptyPerson++
        continue
      }

      const personId = String(personRaw).trim().toUpperCase()
      const athleteId = athleteByPersonId.get(personId)
      if (!athleteId) {
        skippedMissingAthlete++
        missingAthleteIds.add(personId)
        continue
      }

      const measuredAt = parseDateValue(cellToPlain(row.getCell(dateCol).value))
      if (!measuredAt) {
        skippedMissingDate++
        continue
      }

      const measuredAtIso = measuredAt.toUTC().toISO()!
      let rowHasValue = false

      for (const { col, typeId } of metricCols) {
        const raw = valueToString(cellToPlain(row.getCell(col).value))
        if (raw === null) continue
        rowHasValue = true
        const key = cacheKey(athleteId, typeId, measuredAtIso)
        const existingPending = pendingByKey.get(key)
        pendingByKey.set(key, {
          athleteId,
          biomarkerTypeId: typeId,
          value: preferBiomarkerValue(existingPending?.value, raw),
          measuredAt: measuredAtIso,
        })
      }

      if (rowHasValue) rowsAccepted++
    }

    this.logger.info(`Rows accepted: ${rowsAccepted}, unique values: ${pendingByKey.size}`)

    if (this.dryRun) {
      this.logger.info(`Dry run — would upsert ${pendingByKey.size} biomarker values`)
      this.logger.info(
        `Skipped: emptyPerson=${skippedEmptyPerson}, missingAthlete=${skippedMissingAthlete}, missingDate=${skippedMissingDate}`
      )
      if (missingAthleteIds.size > 0) {
        this.logger.warning(
          `Missing SAP athletes (${missingAthleteIds.size}): ${[...missingAthleteIds].slice(0, 15).join(', ')}`
        )
      }
      return
    }

    const athleteIds = [...new Set([...pendingByKey.values()].map((v) => v.athleteId))]
    const typeIds = types.map((type) => type.id)
    const measuredAts = [...new Set([...pendingByKey.values()].map((v) => v.measuredAt))]

    this.logger.info('Loading existing biomarkers…')
    const existingRows = await db
      .from('biomarkers')
      .select('id', 'athlete_id', 'biomarker_type_id', 'value', 'measured_at')
      .whereIn('athlete_id', athleteIds)
      .whereIn('biomarker_type_id', typeIds)
      .whereIn(
        'measured_at',
        measuredAts.map((iso) => DateTime.fromISO(iso, { zone: 'utc' }).toSQL()!)
      )

    const existingByKey = new Map<string, { id: string; value: string }>()
    for (const row of existingRows) {
      const measuredAtIso = DateTime.fromJSDate(new Date(row.measured_at), { zone: 'utc' })
        .startOf('day')
        .toUTC()
        .toISO()!
      existingByKey.set(cacheKey(row.athlete_id, row.biomarker_type_id, measuredAtIso), {
        id: row.id,
        value: row.value,
      })
    }

    this.logger.info(`Existing matches: ${existingByKey.size}`)

    const toCreate: Array<{
      athlete_id: string
      biomarker_type_id: string
      value: string
      measured_at: string
    }> = []
    const toUpdate: Array<{ id: string; value: string }> = []
    let unchanged = 0

    for (const [key, pending] of pendingByKey) {
      const existing = existingByKey.get(key)
      if (existing) {
        if (existing.value !== pending.value) {
          toUpdate.push({ id: existing.id, value: pending.value })
        } else {
          unchanged++
        }
        continue
      }

      toCreate.push({
        athlete_id: pending.athleteId,
        biomarker_type_id: pending.biomarkerTypeId,
        value: pending.value,
        measured_at: pending.measuredAt,
      })
    }

    this.logger.info(`Will create=${toCreate.length}, update=${toUpdate.length}, unchanged=${unchanged}`)

    const batchSize = 1000
    for (let i = 0; i < toCreate.length; i += batchSize) {
      const batch = toCreate.slice(i, i + batchSize)
      await db.table('biomarkers').insert(batch)
      this.logger.info(`Created ${Math.min(i + batchSize, toCreate.length)}/${toCreate.length}`)
    }

    for (let i = 0; i < toUpdate.length; i += batchSize) {
      const batch = toUpdate.slice(i, i + batchSize)
      await db.transaction(async (trx) => {
        for (const item of batch) {
          await trx.from('biomarkers').where('id', item.id).update({
            value: item.value,
            updated_at: DateTime.utc().toSQL(),
          })
        }
      })
      this.logger.info(`Updated ${Math.min(i + batchSize, toUpdate.length)}/${toUpdate.length}`)
    }

    this.logger.info(
      `Skipped: emptyPerson=${skippedEmptyPerson}, missingAthlete=${skippedMissingAthlete}, missingDate=${skippedMissingDate}`
    )
    if (missingAthleteIds.size > 0) {
      this.logger.warning(
        `Missing SAP athletes (${missingAthleteIds.size}): ${[...missingAthleteIds].slice(0, 15).join(', ')}`
      )
    }
    this.logger.success('Diagnostik import done')
  }
}
