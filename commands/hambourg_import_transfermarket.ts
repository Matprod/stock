import { HAMBOURG_CLUB_ID, TRANSFERMARKET_FILE } from '#constants/hambourg.constants'
import Athlete from '#models_pg/athlete'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { DateTime } from 'luxon'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

type TransfermarketRow = {
  playerName: string
  athleteId: string
  startDate: DateTime
  endDate: DateTime | null
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (char === ',' && !inQuotes) {
      cells.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  cells.push(current.trim())
  return cells
}

function parseDate(value: string): DateTime | null {
  const text = value.trim()
  if (!text) return null
  const parsed = DateTime.fromISO(text, { zone: 'utc' })
  return parsed.isValid ? parsed.startOf('day') : null
}

function sameDate(current: DateTime | null | undefined, next: DateTime | null): boolean {
  if (!current && !next) return true
  if (!current || !next) return false
  return current.toISODate() === next.toISODate()
}

function parseTransfermarketCsv(filePath: string): TransfermarketRow[] {
  const content = readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '')
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length < 2) return []

  const header = parseCsvLine(lines[0])
  const indexOf = (name: string) => header.indexOf(name)
  const playerNameIdx = indexOf('player_name')
  const athleteIdIdx = indexOf('athlete_id')
  const arriveeIdx = indexOf('tm_arrivee_hsv')
  const departIdx = indexOf('tm_depart_hsv')

  if (athleteIdIdx < 0 || arriveeIdx < 0 || departIdx < 0) {
    throw new Error('CSV must include athlete_id, tm_arrivee_hsv and tm_depart_hsv')
  }

  const rows: TransfermarketRow[] = []
  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line)
    const athleteId = (cells[athleteIdIdx] ?? '').trim()
    const startDate = parseDate(cells[arriveeIdx] ?? '')
    if (!athleteId || !startDate) continue

    rows.push({
      playerName: (cells[playerNameIdx] ?? '').trim(),
      athleteId,
      startDate,
      endDate: parseDate(cells[departIdx] ?? ''),
    })
  }

  return rows
}

export default class HambourgImportTransfermarket extends BaseCommand {
  static commandName = 'hambourg:import-transfermarket'
  static description =
    'Update Hamburg athletes startDate/endDate from hambourg/transfermarket.csv'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({
    description: 'Path to transfermarket CSV',
    default: TRANSFERMARKET_FILE,
  })
  declare file: string

  @flags.boolean({
    description: 'Preview updates without writing',
  })
  declare dryRun: boolean

  @flags.number({
    description: 'Number of sample updates to print',
    default: 20,
  })
  declare show: number

  async run() {
    const filePath = this.file.startsWith('/')
      ? this.file
      : join(process.cwd(), this.file.replace(/^\.\//, ''))

    const rows = parseTransfermarketCsv(filePath)
    const athletes = await Athlete.query()
      .where('clubId', HAMBOURG_CLUB_ID)
      .whereIn(
        'id',
        rows.map((row) => row.athleteId)
      )

    const athleteById = new Map(athletes.map((athlete) => [athlete.id, athlete]))
    let startUpdated = 0
    let endUpdated = 0
    let unchanged = 0
    let missing = 0
    const samples: string[] = []
    const missingIds: string[] = []

    for (const row of rows) {
      const athlete = athleteById.get(row.athleteId)
      if (!athlete) {
        missing++
        missingIds.push(`${row.playerName} ${row.athleteId}`)
        continue
      }

      const updates: Partial<Pick<Athlete, 'startDate' | 'endDate'>> = {}
      if (!sameDate(athlete.startDate, row.startDate)) {
        updates.startDate = row.startDate
        startUpdated++
      }
      if (!sameDate(athlete.endDate, row.endDate)) {
        updates.endDate = row.endDate
        endUpdated++
      }

      if (Object.keys(updates).length === 0) {
        unchanged++
        continue
      }

      if (samples.length < this.show) {
        samples.push(
          `${athlete.firstName} ${athlete.lastName}: ${athlete.startDate?.toISODate() ?? '—'} → ${row.startDate.toISODate()} | ${athlete.endDate?.toISODate() ?? '—'} → ${row.endDate?.toISODate() ?? '—'}`
        )
      }

      if (!this.dryRun) {
        athlete.merge(updates)
        await athlete.save()
      }
    }

    console.log('')
    console.log(`Transfermarkt CSV: ${filePath}${this.dryRun ? ' (dry-run)' : ''}`)
    console.log(`Rows: ${rows.length}`)
    console.log(`Matched Hamburg athletes: ${athletes.length}`)
    console.log(`Missing athletes: ${missing}`)
    console.log(`Updated: startDate=${startUpdated} endDate=${endUpdated} unchanged=${unchanged}`)

    if (samples.length > 0) {
      console.log('')
      console.log(`Samples (showing ${samples.length})`)
      for (const sample of samples) {
        console.log(`  - ${sample}`)
      }
    }

    if (missingIds.length > 0) {
      console.log('')
      console.log(`Missing (showing ${Math.min(this.show, missingIds.length)}/${missingIds.length})`)
      for (const row of missingIds.slice(0, this.show)) {
        console.log(`  - ${row}`)
      }
    }

    console.log('')

    if (this.dryRun) {
      this.logger.info(`Dry run: would update startDate=${startUpdated} endDate=${endUpdated}`)
    } else {
      this.logger.success(`Updated startDate=${startUpdated} endDate=${endUpdated}`)
    }
  }
}
