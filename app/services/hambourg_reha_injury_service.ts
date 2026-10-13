import { ATHLETE_PROVIDER_SOURCE } from '#constants/athlete_provider.constants'
import {
  HAMBOURG_CLUB_ID,
  REHA_INJURIES_DIR,
  REHA_INJURIES_FILE_PREFIX,
} from '#constants/hambourg.constants'
import Athlete from '#models_pg/athlete'
import Injury from '#models_pg/injury'
import InjurySection from '#models_pg/injury_section'
import InjuryType from '#models_pg/injury_type'
import {
  extractTissueAndBodyArea,
  findSectionForBodyArea,
  normalizeInjuryText,
  truncateString,
} from '#utils/injury_body_area'
import { deriveRehabMechanismOrNull, resolveTissue } from '#utils/injury_rules'
import db from '@adonisjs/lucid/services/db'
import ExcelJS from 'exceljs'
import { DateTime } from 'luxon'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

const REHA_NAME_ALIASES: Record<string, string> = {
  'sebastiaan bournauw': 'sebastiaan bornauw',
  'bournauw sebastiaan': 'sebastiaan bornauw',
  'bournauw': 'bornauw',
}

const DURATION_DAYS: Record<string, number> = {
  tag: 1,
  tage: 1,
  woche: 7,
  wochen: 7,
}

type PlainCell = string | number | Date | null

type AthleteHit =
  | { status: 'matched'; athlete: Athlete }
  | { status: 'missing'; name: string }
  | { status: 'ambiguous'; name: string }

export type RehaInjuryImportResult = {
  dryRun: boolean
  file: string
  created: string[]
  updated: string[]
  unchanged: string[]
  missing: string[]
  ambiguous: string[]
  invalid: string[]
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

const foldLabel = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
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

const cellText = (value: PlainCell): string => {
  if (value === null || value instanceof Date || typeof value === 'number') return ''
  return value.trim()
}

const parseDateValue = (value: PlainCell): DateTime | null => {
  if (value === null || value === '') return null

  if (value instanceof Date) {
    const parsed = DateTime.fromObject(
      { year: value.getFullYear(), month: value.getMonth() + 1, day: value.getDate() },
      { zone: 'utc' }
    )
    return parsed.isValid ? parsed.startOf('day') : null
  }

  if (typeof value === 'number') {
    const parsed = DateTime.fromObject({ year: 1899, month: 12, day: 30 }, { zone: 'utc' }).plus({
      days: value,
    })
    return parsed.isValid ? parsed.startOf('day') : null
  }

  const isoDay = value.trim().match(/^(\d{4}-\d{2}-\d{2})/)
  if (!isoDay) return null
  const parsed = DateTime.fromISO(isoDay[1], { zone: 'utc' })
  return parsed.isValid ? parsed.startOf('day') : null
}

const durationDays = (value: string): number | null => {
  let best: number | null = null
  for (const part of value.split('/')) {
    let total = 0
    let found = false
    for (const match of part.matchAll(/(\d+)\s*(tag|tage|woche|wochen)/gi)) {
      found = true
      total += Number(match[1]) * DURATION_DAYS[match[2].toLowerCase()]
    }
    if (found && (best === null || total > best)) best = total
  }
  return best
}

const mapRehaContact = (
  value: string
): 'no_contact' | 'contact' | 'semi_contact' | null => {
  const normalized = normalizeInjuryText(value)
  if (!normalized) return null
  if (normalized.includes('semi')) return 'semi_contact'
  if (normalized.includes('kein')) return 'no_contact'
  if (normalized.includes('kontakt') || normalized.includes('contact')) return 'contact'
  return null
}

const uniqueAthlete = (athletes: Athlete[]): Athlete | 'ambiguous' | null => {
  if (athletes.length === 1) return athletes[0]
  if (athletes.length > 1) return 'ambiguous'
  return null
}

const typeCacheKey = (name: string, sectionId: string): string =>
  `${normalizeInjuryText(name)}::${sectionId}`

const sameDay = (left: DateTime | null, right: DateTime | null): boolean =>
  (left?.toISODate() ?? null) === (right?.toISODate() ?? null)

const resolveRehaFile = async (file?: string): Promise<string> => {
  if (file) return file
  const names = await readdir(REHA_INJURIES_DIR)
  const match = names.find(
    (name) => name.startsWith(REHA_INJURIES_FILE_PREFIX) && name.endsWith('.xlsx')
  )
  if (!match) {
    throw new Error(`No ${REHA_INJURIES_FILE_PREFIX}*.xlsx in ${REHA_INJURIES_DIR}`)
  }
  return join(REHA_INJURIES_DIR, match)
}

const readFirstSheet = async (file: string): Promise<PlainCell[][]> => {
  const rows: PlainCell[][] = []
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(file, {
    worksheets: 'emit',
    sharedStrings: 'cache',
    hyperlinks: 'ignore',
    styles: 'ignore',
  })

  for await (const worksheet of reader) {
    for await (const row of worksheet) {
      rows.push((row.values as ExcelJS.CellValue[]).slice(1).map(cellToPlain))
    }
    break
  }

  return rows
}

const rowByLabel = (rows: PlainCell[][], label: string): PlainCell[] | null => {
  const wanted = foldLabel(label)
  return rows.find((row) => foldLabel(cellText(row[0] ?? null)) === wanted) ?? null
}

export default class HambourgRehaInjuryService {
  async importFile(options: { file?: string; dryRun?: boolean }): Promise<RehaInjuryImportResult> {
    const dryRun = options.dryRun === true
    const file = await resolveRehaFile(options.file)
    const rows = await readFirstSheet(file)
    const players = rowByLabel(rows, 'Spieler')
    const dates = rowByLabel(rows, 'Verletzungsdatum')
    const injuries = rowByLabel(rows, 'Verletzung')
    const classes = rowByLabel(rows, 'Verletzungsklassifikation')
    const durations = rowByLabel(rows, 'tatsächliche Dauer')
    const operations = rowByLabel(rows, 'OP')

    if (!players || !dates || !injuries) {
      throw new Error('Reha sheet is missing Spieler, Verletzungsdatum or Verletzung')
    }

    const athletes = await Athlete.query().where('clubId', HAMBOURG_CLUB_ID)
    const byFull = new Map<string, Athlete[]>()
    const byLast = new Map<string, Athlete[]>()
    const add = (map: Map<string, Athlete[]>, key: string, athlete: Athlete) => {
      if (!key) return
      const list = map.get(key) ?? []
      list.push(athlete)
      map.set(key, list)
    }
    for (const athlete of athletes) {
      add(byFull, foldName(`${athlete.firstName} ${athlete.lastName}`), athlete)
      add(byLast, foldName(athlete.lastName), athlete)
    }

    const matchAthlete = (raw: string): AthleteHit => {
      const [lastRaw, ...rest] = raw.split(',').map((part) => part.trim())
      const last = lastRaw ?? ''
      const first = rest.join(' ')
      const keys = [foldName(`${first} ${last}`), foldName(`${last} ${first}`), foldName(last)].filter(
        Boolean
      )

      for (const key of keys) {
        const aliased = REHA_NAME_ALIASES[key] ?? key
        const full = uniqueAthlete(byFull.get(aliased) ?? [])
        if (full === 'ambiguous') return { status: 'ambiguous', name: raw }
        if (full) return { status: 'matched', athlete: full }
        const byLastName = uniqueAthlete(byLast.get(aliased) ?? [])
        if (byLastName === 'ambiguous') return { status: 'ambiguous', name: raw }
        if (byLastName) return { status: 'matched', athlete: byLastName }
      }

      return { status: 'missing', name: raw }
    }

    const sections = await InjurySection.query()
    const naSection = await InjurySection.query().whereILike('name', 'N/A').first()
    if (!naSection) throw new Error('Fallback injury section "N/A" not found')

    const existingTypes = await InjuryType.query().where((query) => {
      query.where('clubId', HAMBOURG_CLUB_ID).orWhereNull('clubId')
    })
    const injuryTypeByNameAndSection = new Map(
      existingTypes.map((type) => [typeCacheKey(type.name ?? '', type.categoryId), type])
    )

    const result: RehaInjuryImportResult = {
      dryRun,
      file,
      created: [],
      updated: [],
      unchanged: [],
      missing: [],
      ambiguous: [],
      invalid: [],
    }

    const width = Math.max(players.length, dates.length, injuries.length)

    await db.transaction(async (trx) => {
      for (let col = 1; col < width; col++) {
        const player = cellText(players[col] ?? null)
        if (!player) continue

        const injuryText = cellText(injuries[col] ?? null)
        const start = parseDateValue(dates[col] ?? null)
        if (!injuryText || !start) {
          result.invalid.push(`${player}: missing injury or date`)
          continue
        }

        const hit = matchAthlete(player)
        if (hit.status === 'missing') {
          result.missing.push(player)
          continue
        }
        if (hit.status === 'ambiguous') {
          result.ambiguous.push(player)
          continue
        }

        const pathology = truncateString(injuryText)
        const classification = cellText(classes?.[col] ?? null)
        const contactType = mapRehaContact(classification)
        const days = durationDays(cellText(durations?.[col] ?? null))
        const recovery = days === null ? null : start.plus({ days })
        const normalizedInjury = normalizeInjuryText(injuryText).replace(/\blimks\b/g, 'links')
        let side: 'left' | 'right' | null = null
        if (/\brechts\b/.test(normalizedInjury)) side = 'right'
        else if (/\blinks\b/.test(normalizedInjury)) side = 'left'
        const { bodyArea } = extractTissueAndBodyArea(injuryText)
        const tissue = resolveTissue(null, injuryText)
        const mechanism = deriveRehabMechanismOrNull(injuryText)
        const sidedSections = side
          ? sections.filter((section) => {
              const name = normalizeInjuryText(section.name)
              if (name.startsWith('left') || name.startsWith('right')) return name.startsWith(side)
              return true
            })
          : sections
        const { section, usedNa } = findSectionForBodyArea(bodyArea, sidedSections, naSection)
        const note = truncateString(cellText(operations?.[col] ?? null)) || null
        const context = normalizeInjuryText(injuryText).includes('spiel') ? 'match' : null
        const recoveryLabel = recovery?.toISODate() ?? 'ouverte'
        const sectionLabel = usedNa ? 'N/A' : section.name
        const line = `${player} ${start.toISODate()} → ${recoveryLabel} | ${pathology} | ${contactType ?? '-'} | ${sectionLabel}`

        const typeName = pathology
        const key = typeCacheKey(typeName, section.id)
        let injuryType = injuryTypeByNameAndSection.get(key)
        if (!injuryType) {
          if (dryRun) {
            injuryType = new InjuryType()
            injuryType.name = typeName
            injuryType.categoryId = section.id
            injuryType.clubId = HAMBOURG_CLUB_ID
          } else {
            injuryType = await InjuryType.create(
              { name: typeName, categoryId: section.id, clubId: HAMBOURG_CLUB_ID },
              { client: trx }
            )
          }
          injuryTypeByNameAndSection.set(key, injuryType)
        }

        const existing = await Injury.query({ client: trx })
          .where('athleteId', hit.athlete.id)
          .where('dateOfInjury', start.toISODate()!)
          .where('pathology', pathology)
          .first()

        if (!existing) {
          if (!dryRun && injuryType.id) {
            await Injury.create(
              {
                athleteId: hit.athlete.id,
                typeOfInjuryId: injuryType.id,
                dateOfInjury: start,
                recoveryDate: recovery,
                contactType,
                context,
                mechanism: mechanism ? truncateString(mechanism) : null,
                tissue: tissue ? truncateString(tissue) : null,
                pathology,
                note,
                source: ATHLETE_PROVIDER_SOURCE.SAP,
              },
              { client: trx }
            )
          }
          result.created.push(line)
          continue
        }

        const changed =
          !sameDay(existing.recoveryDate, recovery) ||
          existing.contactType !== contactType ||
          existing.context !== context ||
          (existing.mechanism ?? null) !== (mechanism ? truncateString(mechanism) : null) ||
          (existing.tissue ?? null) !== (tissue ? truncateString(tissue) : null) ||
          (existing.note ?? null) !== note ||
          existing.typeOfInjuryId !== injuryType.id

        if (!changed) {
          result.unchanged.push(line)
          continue
        }

        if (!dryRun && injuryType.id) {
          existing.useTransaction(trx)
          existing.recoveryDate = recovery
          existing.contactType = contactType
          existing.context = context
          existing.mechanism = mechanism ? truncateString(mechanism) : null
          existing.tissue = tissue ? truncateString(tissue) : null
          existing.note = note
          existing.typeOfInjuryId = injuryType.id
          await existing.save()
        }
        result.updated.push(line)
      }
    })

    return result
  }
}
