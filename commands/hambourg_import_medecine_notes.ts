import { ATHLETE_PROVIDER_TYPES } from '#constants/athlete_provider.constants'
import { EVENT_CATEGORY } from '#constants/event.constants'
import {
  HAMBOURG_CLUB_ID,
  MEDECINE_FILE,
  MEDECINE_SAP_MAPPING_FILE,
} from '#constants/hambourg.constants'
import AthleteProvider from '#models_pg/athlete_provider'
import PlayerNote from '#models_pg/player_note'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { readFileSync } from 'node:fs'
import ExcelJS from 'exceljs'
import { DateTime } from 'luxon'

type SapMappingRow = {
  sheet: string
  personId: string | null
  lastName: string
  firstName: string
}

type ParsedNote = {
  sheet: string
  personId: string
  athleteId: string
  noteDate: DateTime
  content: string
  source: 'chronology' | 'anamnesis'
  row: number
}

function excelSerialToDateTime(serial: number): DateTime {
  return DateTime.fromObject({ year: 1899, month: 12, day: 30 }, { zone: 'utc' }).plus({
    days: serial,
  })
}

function cellText(value: ExcelJS.CellValue): string | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'number' || typeof value === 'string') return String(value)
  if (typeof value === 'boolean') return value ? '1' : '0'

  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('')
    }
    if ('text' in value && typeof value.text === 'string') return value.text
    if ('result' in value) return cellText(value.result as ExcelJS.CellValue)
  }

  return String(value)
}

function isPlausibleNoteDate(date: DateTime | null): date is DateTime {
  return !!date && date.isValid && date.year >= 1990 && date.year <= 2035
}

function parseCompactDmyNumber(value: number): DateTime | null {
  // e.g. 13102025 → 13.10.2025 (typed without separators, not an Excel serial)
  if (!Number.isInteger(value) || value < 1011990 || value > 31122035) return null
  const text = String(value)
  if (text.length !== 8) return null
  const day = Number(text.slice(0, 2))
  const month = Number(text.slice(2, 4))
  const year = Number(text.slice(4, 8))
  const parsed = DateTime.fromObject({ year, month, day }, { zone: 'utc' }).startOf('day')
  return isPlausibleNoteDate(parsed) ? parsed : null
}

function parseNoteDate(value: ExcelJS.CellValue): DateTime | null {
  if (value === null || value === undefined || value === '') return null

  if (value instanceof Date) {
    const parsed = DateTime.fromJSDate(value, { zone: 'utc' }).startOf('day')
    return isPlausibleNoteDate(parsed) ? parsed : null
  }

  if (typeof value === 'number') {
    const compact = parseCompactDmyNumber(value)
    if (compact) return compact

    // Excel serial dates are typically ~30k–60k for 1980–2060
    if (value >= 20000 && value <= 60000) {
      const parsed = excelSerialToDateTime(value).startOf('day')
      return isPlausibleNoteDate(parsed) ? parsed : null
    }

    return null
  }

  const text = cellText(value)?.trim()
  if (!text) return null

  const iso = DateTime.fromISO(text, { zone: 'utc' })
  if (isPlausibleNoteDate(iso)) return iso.startOf('day')

  const dmy = text.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/)
  if (dmy) {
    const day = Number(dmy[1])
    const month = Number(dmy[2])
    let year = Number(dmy[3])
    if (year < 100) year += 2000
    const parsed = DateTime.fromObject({ year, month, day }, { zone: 'utc' })
    return isPlausibleNoteDate(parsed) ? parsed.startOf('day') : null
  }

  // ranges / fuzzy: take first day
  // 06. bis 08.08.25 | 30.11.-1.12.25 | 14.-19.07.25 | 23.-27.6.25 | ab 01.08.25 | 12.+13.11.2025
  const range =
    text.match(/(\d{1,2})\.\s*(?:bis|-|\+)\s*\d{1,2}\.?(\d{0,2})\.?(\d{2,4})?/i) ||
    text.match(/(?:ab\s+)?(\d{1,2})[./](\d{1,2})[./](\d{2,4})/i) ||
    text.match(/(\d{1,2})\.-(\d{1,2})\.(\d{1,2})\.?(\d{2,4})?/)

  if (range) {
    const day = Number(range[1])
    let month = Number(range[2] || range[3])
    let yearRaw = range[3] || range[4]
    // patterns like 14.-19.07.25 → groups differ
    const alt = text.match(/(\d{1,2})\.-?\d{0,2}\.?(\d{1,2})\.(\d{2,4})/)
    if (alt) {
      const d = Number(alt[1])
      const m = Number(alt[2])
      let y = Number(alt[3])
      if (y < 100) y += 2000
      const parsed = DateTime.fromObject({ year: y, month: m, day: d }, { zone: 'utc' })
      if (isPlausibleNoteDate(parsed)) return parsed.startOf('day')
    }

    if (yearRaw) {
      let year = Number(yearRaw)
      if (year < 100) year += 2000
      if (!month || month > 12) {
        const m2 = text.match(/\.(\d{1,2})\.(\d{2,4})/)
        if (m2) {
          month = Number(m2[1])
          year = Number(m2[2])
          if (year < 100) year += 2000
        }
      }
      const parsed = DateTime.fromObject({ year, month, day }, { zone: 'utc' })
      if (isPlausibleNoteDate(parsed)) return parsed.startOf('day')
    }
  }

  return null
}

function rowContent(row: ExcelJS.Row, fromCol = 2, toCol = 6): string {
  const parts: string[] = []
  for (let col = fromCol; col <= toCol; col++) {
    const raw = row.getCell(col).value
    if (raw instanceof Date) {
      parts.push(DateTime.fromJSDate(raw, { zone: 'utc' }).toISODate() ?? '')
      continue
    }
    const text = cellText(raw)?.trim()
    if (text) parts.push(text)
  }
  return parts.join(' | ').trim()
}

function loadSapMapping(path: string): Map<string, SapMappingRow> {
  const lines = readFileSync(path, 'utf8').trim().split(/\r?\n/)
  const map = new Map<string, SapMappingRow>()
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    const [sheet, personId, lastName = '', firstName = ''] = line.split(',')
    map.set(sheet.trim(), {
      sheet: sheet.trim(),
      personId: personId?.trim() ? personId.trim().toUpperCase() : null,
      lastName: lastName.trim(),
      firstName: firstName.trim(),
    })
  }
  return map
}

function isChronologyHeader(text: string): boolean {
  return /chronologie/i.test(text)
}

function isDatumHeader(text: string): boolean {
  return /^datum\s*:?\s*$/i.test(text.trim())
}

export default class HambourgImportMedecineNotes extends BaseCommand {
  static commandName = 'hambourg:import-medecine-notes'
  static description =
    'Import medical notes from medecine.xlsx (sheet → SAP PersonId mapping CSV)'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({ description: 'Path to medecine xlsx', default: MEDECINE_FILE })
  declare file: string

  @flags.string({
    description: 'Path to sheet→SAP mapping CSV',
    default: MEDECINE_SAP_MAPPING_FILE,
  })
  declare mapping: string

  @flags.boolean({ description: 'Parse and resolve athletes only, do not write' })
  declare dryRun: boolean

  @flags.boolean({
    description: 'Also import anamnesis block (Starker Fuß, Narben, …)',
    default: true,
  })
  declare anamnesis: boolean

  @flags.number({ description: 'Sample notes printed in dry-run', default: 15 })
  declare show: number

  async run() {
    const mapping = loadSapMapping(this.mapping)
    const providers = await AthleteProvider.query()
      .where('provider', ATHLETE_PROVIDER_TYPES.SAP)
      .whereNotNull('providerAthleteId')
      .preload('athlete', (q) => q.where('clubId', HAMBOURG_CLUB_ID))

    const athleteByPersonId = new Map<string, string>()
    for (const provider of providers) {
      if (!provider.providerAthleteId || !provider.athlete) continue
      athleteByPersonId.set(provider.providerAthleteId.trim().toUpperCase(), provider.athlete.id)
    }

    this.logger.info(`SAP athletes loaded: ${athleteByPersonId.size}`)
    this.logger.info(`Mapping rows: ${mapping.size}`)

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(this.file)

    const notes: ParsedNote[] = []
    const skippedNoMapping: string[] = []
    const skippedNoPersonId: string[] = []
    const skippedNoAthlete: string[] = []
    const skippedNoDate: Array<{ sheet: string; row: number; preview: string }> = []
    let sheetsProcessed = 0

    for (const [index, sheet] of workbook.worksheets.entries()) {
      if (index < 2) continue
      sheetsProcessed++

      const mapRow = mapping.get(sheet.name)
      if (!mapRow) {
        skippedNoMapping.push(sheet.name)
        continue
      }
      if (!mapRow.personId) {
        skippedNoPersonId.push(sheet.name)
        continue
      }

      const athleteId = athleteByPersonId.get(mapRow.personId)
      if (!athleteId) {
        skippedNoAthlete.push(`${sheet.name} (${mapRow.personId})`)
        continue
      }

      let datumRow: number | null = null
      for (let r = 1; r <= sheet.rowCount; r++) {
        const text = cellText(sheet.getRow(r).getCell(1).value)
        if (text && isDatumHeader(text)) {
          datumRow = r
          break
        }
      }

      const chronologyNotes: ParsedNote[] = []
      let lastDate: DateTime | null = null

      if (datumRow) {
        for (let r = datumRow + 1; r <= sheet.rowCount; r++) {
          const row = sheet.getRow(r)
          const dateCell = row.getCell(1).value
          const labelOrDate = cellText(dateCell)?.trim() ?? ''
          const content = rowContent(row)
          const parsedDate = parseNoteDate(dateCell)

          if (parsedDate) {
            lastDate = parsedDate
            if (!content) continue
            chronologyNotes.push({
              sheet: sheet.name,
              personId: mapRow.personId,
              athleteId,
              noteDate: parsedDate,
              content,
              source: 'chronology',
              row: r,
            })
            continue
          }

          if (!content && !labelOrDate) continue

          if (!lastDate) {
            skippedNoDate.push({
              sheet: sheet.name,
              row: r,
              preview: (labelOrDate || content).slice(0, 80),
            })
            continue
          }

          // Label row (e.g. MRT) or continuation without date → attach last date
          const fullContent = labelOrDate && content ? `${labelOrDate}: ${content}` : content || labelOrDate
          chronologyNotes.push({
            sheet: sheet.name,
            personId: mapRow.personId,
            athleteId,
            noteDate: lastDate,
            content: fullContent,
            source: 'chronology',
            row: r,
          })
        }
      }

      notes.push(...chronologyNotes)

      if (this.anamnesis) {
        const anamEnd = datumRow ? datumRow - 1 : sheet.rowCount
        const fallbackDate =
          chronologyNotes[0]?.noteDate ?? DateTime.fromISO('2025-01-01', { zone: 'utc' })

        for (let r = 5; r <= anamEnd; r++) {
          const row = sheet.getRow(r)
          const label = cellText(row.getCell(1).value)?.trim()
          if (!label) continue
          if (isChronologyHeader(label) || isDatumHeader(label)) continue

          const value = rowContent(row)
          if (!value) continue

          notes.push({
            sheet: sheet.name,
            personId: mapRow.personId,
            athleteId,
            noteDate: fallbackDate,
            content: `${label}: ${value}`,
            source: 'anamnesis',
            row: r,
          })
        }
      }
    }

    const chronologyCount = notes.filter((n) => n.source === 'chronology').length
    const anamnesisCount = notes.filter((n) => n.source === 'anamnesis').length
    const athletes = new Set(notes.map((n) => n.athleteId)).size

    this.logger.info(`Sheets processed (skip first 2): ${sheetsProcessed}`)
    this.logger.info(
      `Notes parsed: ${notes.length} (chronology=${chronologyCount}, anamnesis=${anamnesisCount}) across ${athletes} athletes`
    )
    this.logger.info(`Skipped no mapping: ${skippedNoMapping.length}`)
    this.logger.info(`Skipped no PersonId in CSV: ${skippedNoPersonId.length}`)
    if (skippedNoPersonId.length) this.logger.warning(skippedNoPersonId.join(', '))
    this.logger.info(`Skipped no SAP athlete: ${skippedNoAthlete.length}`)
    if (skippedNoAthlete.length) this.logger.warning(skippedNoAthlete.join(', '))
    this.logger.info(`Skipped no date (before first dated row): ${skippedNoDate.length}`)

    if (this.dryRun) {
      this.logger.info(`Dry-run sample (max ${this.show}):`)
      for (const note of notes.slice(0, this.show)) {
        this.logger.info(
          `  [${note.source}] ${note.sheet}#${note.row} ${note.noteDate.toISODate()} — ${note.content.slice(0, 100).replace(/\n/g, ' ')}`
        )
      }
      this.logger.info('Dry run — nothing written')
      return
    }

    let created = 0
    let skippedExisting = 0
    const batchSize = 500
    const athleteIds = [...new Set(notes.map((n) => n.athleteId))]

    const existing = await PlayerNote.query()
      .whereIn('athleteId', athleteIds)
      .where('category', EVENT_CATEGORY.MEDICAL)

    const existingKeys = new Set(
      existing.map(
        (note) =>
          `${note.athleteId}|${note.noteDate.toISODate()}|${note.content}`
      )
    )

    const toCreate: Array<{
      athleteId: string
      noteDate: DateTime
      content: string
      category: typeof EVENT_CATEGORY.MEDICAL
      eventId: null
    }> = []

    for (const note of notes) {
      const key = `${note.athleteId}|${note.noteDate.toISODate()}|${note.content}`
      if (existingKeys.has(key)) {
        skippedExisting++
        continue
      }
      existingKeys.add(key)
      toCreate.push({
        athleteId: note.athleteId,
        noteDate: note.noteDate,
        content: note.content,
        category: EVENT_CATEGORY.MEDICAL,
        eventId: null,
      })
    }

    for (let i = 0; i < toCreate.length; i += batchSize) {
      const batch = toCreate.slice(i, i + batchSize)
      await PlayerNote.createMany(batch)
      created += batch.length
      this.logger.info(`Created ${Math.min(i + batchSize, toCreate.length)}/${toCreate.length}`)
    }

    this.logger.success(`Done: created=${created}, skippedExisting=${skippedExisting}`)
  }
}
