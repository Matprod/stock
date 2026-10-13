import { ATHLETE_PROVIDER_TYPES } from '#constants/athlete_provider.constants'
import { EVENT_CATEGORY } from '#constants/event.constants'
import { HAMBOURG_CLUB_ID, MEDECINE_FILE } from '#constants/hambourg.constants'
import AthleteProvider from '#models_pg/athlete_provider'
import PlayerNote from '#models_pg/player_note'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import ExcelJS from 'exceljs'
import { DateTime } from 'luxon'

const VUSKOVIC_SHEET = 'Vuskovic L.'
const MARIO_PERSON_ID = '51897E94D943D84C823D75D317737985'
const LUKA_PERSON_ID = 'FF0331ED334E78488B4B9FE6D8A73DC2'

function excelSerialToDateTime(serial: number): DateTime {
  return DateTime.fromObject({ year: 1899, month: 12, day: 30 }, { zone: 'utc' }).plus({
    days: serial,
  })
}

function cellText(value: ExcelJS.CellValue): string | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'number' || typeof value === 'string') return String(value)
  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('')
    }
    if ('text' in value && typeof value.text === 'string') return value.text
    if ('result' in value) return cellText(value.result as ExcelJS.CellValue)
  }
  return String(value)
}

function parseNoteDate(value: ExcelJS.CellValue): DateTime | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) {
    const parsed = DateTime.fromJSDate(value, { zone: 'utc' }).startOf('day')
    return parsed.isValid ? parsed : null
  }
  if (typeof value === 'number') {
    const parsed = excelSerialToDateTime(value).startOf('day')
    return parsed.isValid ? parsed : null
  }
  const text = cellText(value)?.trim()
  if (!text) return null
  const iso = DateTime.fromISO(text, { zone: 'utc' })
  if (iso.isValid) return iso.startOf('day')
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

function isChronologyHeader(text: string): boolean {
  return /chronologie/i.test(text)
}

function isDatumHeader(text: string): boolean {
  return /^datum\s*:?\s*$/i.test(text.trim())
}

function isPlausibleNoteDate(date: DateTime | null): date is DateTime {
  return !!date && date.isValid && date.year >= 1990 && date.year <= 2035
}

function parseCompactDmyNumber(value: number): DateTime | null {
  if (!Number.isInteger(value) || value < 1011990 || value > 31122035) return null
  const text = String(value)
  if (text.length !== 8) return null
  const parsed = DateTime.fromObject(
    {
      year: Number(text.slice(4, 8)),
      month: Number(text.slice(2, 4)),
      day: Number(text.slice(0, 2)),
    },
    { zone: 'utc' }
  ).startOf('day')
  return isPlausibleNoteDate(parsed) ? parsed : null
}

function parseNoteDateCell(value: ExcelJS.CellValue): DateTime | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) {
    const parsed = DateTime.fromJSDate(value, { zone: 'utc' }).startOf('day')
    return isPlausibleNoteDate(parsed) ? parsed : null
  }
  if (typeof value === 'number') {
    const compact = parseCompactDmyNumber(value)
    if (compact) return compact
    if (value >= 20000 && value <= 60000) {
      const parsed = excelSerialToDateTime(value).startOf('day')
      return isPlausibleNoteDate(parsed) ? parsed : null
    }
    return null
  }
  return parseNoteDate(value)
}

type ExpectedNote = { noteDate: string; content: string }

async function parseVuskovicNotes(): Promise<ExpectedNote[]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(MEDECINE_FILE)
  const sheet = workbook.getWorksheet(VUSKOVIC_SHEET)
  if (!sheet) throw new Error(`Sheet "${VUSKOVIC_SHEET}" not found`)

  const notes: ExpectedNote[] = []
  let datumRow: number | null = null

  for (let r = 1; r <= sheet.rowCount; r++) {
    const text = cellText(sheet.getRow(r).getCell(1).value)
    if (text && isDatumHeader(text)) {
      datumRow = r
      break
    }
  }

  let lastDate: DateTime | null = null

  if (datumRow) {
    for (let r = datumRow + 1; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r)
      const dateCell = row.getCell(1).value
      const labelOrDate = cellText(dateCell)?.trim() ?? ''
      const content = rowContent(row)
      const parsedDate = parseNoteDateCell(dateCell)

      if (parsedDate) {
        lastDate = parsedDate
        if (content) notes.push({ noteDate: parsedDate.toISODate()!, content })
        continue
      }

      if (!content && !labelOrDate) continue
      if (!lastDate) continue

      const fullContent =
        labelOrDate && content ? `${labelOrDate}: ${content}` : content || labelOrDate
      notes.push({ noteDate: lastDate.toISODate()!, content: fullContent })
    }
  }

  const anamEnd = datumRow ? datumRow - 1 : sheet.rowCount
  const fallbackDate = notes[0]?.noteDate ?? '2025-01-01'

  for (let r = 5; r <= anamEnd; r++) {
    const row = sheet.getRow(r)
    const label = cellText(row.getCell(1).value)?.trim()
    if (!label || isChronologyHeader(label) || isDatumHeader(label)) continue
    const value = rowContent(row)
    if (!value) continue
    notes.push({ noteDate: fallbackDate, content: `${label}: ${value}` })
  }

  return notes
}

export default class HambourgFixVuskovicNotes extends BaseCommand {
  static commandName = 'hambourg:fix-vuskovic-notes'
  static description =
    'Reassign Vuskovic L. medecine notes from Mario to Luka Vušković (wrong SAP PersonId in mapping)'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({ description: 'Show matches without updating' })
  declare dryRun: boolean

  async run() {
    const providers = await AthleteProvider.query()
      .where('provider', ATHLETE_PROVIDER_TYPES.SAP)
      .whereIn('providerAthleteId', [MARIO_PERSON_ID, LUKA_PERSON_ID])
      .preload('athlete', (q) => q.where('clubId', HAMBOURG_CLUB_ID))

    const athleteByPerson = new Map(
      providers
        .filter((p) => p.providerAthleteId && p.athlete)
        .map((p) => [p.providerAthleteId!.trim().toUpperCase(), p.athlete.id])
    )

    const marioAthleteId = athleteByPerson.get(MARIO_PERSON_ID)
    const lukaAthleteId = athleteByPerson.get(LUKA_PERSON_ID)

    if (!marioAthleteId || !lukaAthleteId) {
      this.logger.error('Could not resolve Mario and/or Luka athlete via SAP provider')
      this.exitCode = 1
      return
    }

    const expectedNotes = await parseVuskovicNotes()
    this.logger.info(`Parsed ${expectedNotes.length} notes from sheet "${VUSKOVIC_SHEET}"`)

    const marioNotes = await PlayerNote.query()
      .where('athleteId', marioAthleteId)
      .where('category', EVENT_CATEGORY.MEDICAL)

    const marioByKey = new Map(
      marioNotes.map((note) => [`${note.noteDate.toISODate()}|${note.content}`, note])
    )

    let moved = 0
    let notFound = 0
    let alreadyOnLuka = 0

    for (const expected of expectedNotes) {
      const key = `${expected.noteDate}|${expected.content}`
      const note = marioByKey.get(key)
      if (!note) {
        const onLuka = await PlayerNote.query()
          .where('athleteId', lukaAthleteId)
          .where('category', EVENT_CATEGORY.MEDICAL)
          .where('noteDate', expected.noteDate)
          .where('content', expected.content)
          .first()
        if (onLuka) alreadyOnLuka++
        else notFound++
        continue
      }

      if (this.dryRun) {
        this.logger.info(`  would move ${expected.noteDate}: ${expected.content.slice(0, 60)}`)
        moved++
        continue
      }

      note.athleteId = lukaAthleteId
      await note.save()
      moved++
    }

    this.logger.info(`Moved: ${moved}, already on Luka: ${alreadyOnLuka}, not found on Mario: ${notFound}`)
    if (this.dryRun) this.logger.info('Dry run — nothing written')
    else this.logger.success('Vuskovic notes reassigned to Luka')
  }
}
