import {
  ATHLETE_PROVIDER_SOURCE,
  ATHLETE_PROVIDER_TYPES,
} from '#constants/athlete_provider.constants'
import { HAMBOURG_CLUB_ID, HAMBOURG_DIR } from '#constants/hambourg.constants'
import AthleteProvider from '#models_pg/athlete_provider'
import Injury from '#models_pg/injury'
import InjurySection from '#models_pg/injury_section'
import InjuryType from '#models_pg/injury_type'
import {
  extractTissueAndBodyArea,
  findSectionForBodyArea,
  injuriesCoincide,
  mapContactType,
  normalizeInjuryText,
  truncateString,
} from '#utils/injury_body_area'
import { deriveRehabMechanism, resolveTissue } from '#utils/injury_rules'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import ExcelJS from 'exceljs'
import { DateTime } from 'luxon'
import { join } from 'node:path'

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
    const parsed = DateTime.fromJSDate(value, { zone: 'utc' })
    return parsed.isValid ? parsed : null
  }

  if (typeof value === 'number') {
    const parsed = excelSerialToDateTime(value)
    return parsed.isValid ? parsed : null
  }

  const text = String(value).trim()
  if (!text) return null

  const fromIso = DateTime.fromISO(text, { zone: 'utc' })
  if (fromIso.isValid) return fromIso

  const fromSql = DateTime.fromSQL(text, { zone: 'utc' })
  if (fromSql.isValid) return fromSql

  const jsDate = new Date(text)
  if (!Number.isNaN(jsDate.getTime())) {
    return DateTime.fromJSDate(jsDate, { zone: 'utc' })
  }

  const englishPrefix = text.split(':')[0]
  const fromPrefix = DateTime.fromFormat(englishPrefix, 'LLLL d, yyyy', { zone: 'utc' })
  if (fromPrefix.isValid) return fromPrefix

  return null
}

function typeCacheKey(name: string, sectionId: string): string {
  return `${normalizeInjuryText(name)}::${sectionId}`
}

export default class HambourgImportInjuries extends BaseCommand {
  static commandName = 'hambourg:import-injuries'
  static description =
    'Import Hamburg injuries xlsx: Excel label → injury_type (club), tissue mapping → section'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({
    description: 'Path to injuries xlsx file',
    default: join(HAMBOURG_DIR, 'injuries-2022-2023.xlsx'),
  })
  declare file: string

  @flags.number({
    description: 'Number of unresolved rows printed by category',
    default: 20,
  })
  declare show: number

  @flags.boolean({
    description: 'Dry run — parse and link only, do not write injuries / types',
  })
  declare dryRun: boolean

  async run() {
    const providers = await AthleteProvider.query()
      .where('provider', ATHLETE_PROVIDER_TYPES.SAP)
      .whereNotNull('providerAthleteId')
      .preload('athlete')

    const providerToAthlete = new Map(
      providers
        .filter((provider) => provider.providerAthleteId && provider.athlete)
        .map((provider) => [provider.providerAthleteId!, provider.athlete])
    )

    const sections = await InjurySection.query()
    const naSection = await InjurySection.query().whereILike('name', 'N/A').first()
    if (!naSection) {
      this.logger.error('Fallback injury section "N/A" not found')
      this.exitCode = 1
      return
    }

    const existingTypes = await InjuryType.query().where((query) => {
      query.where('clubId', HAMBOURG_CLUB_ID).orWhereNull('clubId')
    })
    const injuryTypeByNameAndSection = new Map(
      existingTypes.map((type) => [typeCacheKey(type.name ?? '', type.categoryId), type])
    )

    const resolveInjuryType = async (
      injuryLabel: string,
      section: InjurySection
    ): Promise<{ type: InjuryType; created: boolean }> => {
      const typeName = truncateString(injuryLabel)
      const key = typeCacheKey(typeName, section.id)
      const cached = injuryTypeByNameAndSection.get(key)
      if (cached) return { type: cached, created: false }

      if (this.dryRun) {
        const preview = new InjuryType()
        preview.name = typeName
        preview.categoryId = section.id
        preview.clubId = HAMBOURG_CLUB_ID
        injuryTypeByNameAndSection.set(key, preview)
        return { type: preview, created: true }
      }

      const created = await InjuryType.create({
        name: typeName,
        categoryId: section.id,
        clubId: HAMBOURG_CLUB_ID,
      })
      injuryTypeByNameAndSection.set(key, created)
      return { type: created, created: true }
    }

    const rowsByIndex = new Map<number, Array<string | number | null>>()
    const reader = new ExcelJS.stream.xlsx.WorkbookReader(this.file, {
      worksheets: 'emit',
      sharedStrings: 'cache',
      hyperlinks: 'ignore',
      styles: 'ignore',
    })

    for await (const worksheet of reader) {
      for await (const row of worksheet) {
        rowsByIndex.set(row.number, (row.values as ExcelJS.CellValue[]).slice(1).map(cellToPlain))
      }
      break
    }

    const headerRow = rowsByIndex.get(1) ?? []
    const idRow = rowsByIndex.get(2) ?? []
    const startRow = rowsByIndex.get(3) ?? []
    const injuryRow = rowsByIndex.get(4) ?? []
    const classificationRow = rowsByIndex.get(5) ?? []
    const maxColumns = Math.max(headerRow.length, idRow.length, startRow.length, injuryRow.length)

    let total = 0
    let created = 0
    let skippedExisting = 0
    let replacedSap = 0
    let createdTypes = 0
    let sectionNaCount = 0
    let missingLabel = 0
    const missingAthlete: string[] = []
    const missingStart: string[] = []
    const missingEnd: string[] = []
    const missingLabelRows: string[] = []
    const sectionNaRows: string[] = []
    const createdTypeRows: string[] = []
    const createdRows: string[] = []
    const replacedSapRows: string[] = []

    for (let col = 1; col < maxColumns; col++) {
      const player = (headerRow[col] ? String(headerRow[col]) : '').trim()
      const statsportPlayerId = (idRow[col] ? String(idRow[col]) : '').trim()
      const injuryText = (injuryRow[col] ? String(injuryRow[col]) : '').trim()
      const classification = (classificationRow[col] ? String(classificationRow[col]) : '').trim()
      const startDate = parseDateValue(startRow[col])

      if (!player && !statsportPlayerId && !injuryText && !startDate) {
        continue
      }

      total++
      const athlete = statsportPlayerId ? providerToAthlete.get(statsportPlayerId) : null
      const { bodyArea } = extractTissueAndBodyArea(injuryText || null)
      const pathology = truncateString(injuryText)
      const tissue = resolveTissue(null, injuryText)
      const mechanism = deriveRehabMechanism(injuryText)
      const { section, usedNa } = findSectionForBodyArea(bodyArea, sections, naSection)
      if (usedNa) sectionNaCount++

      const rehabDates: DateTime[] = []
      for (const [rowIndex, rowValues] of rowsByIndex) {
        if (rowIndex <= 3) continue
        const parsed = parseDateValue(rowValues[col] ?? null)
        if (parsed && parsed.isValid) {
          rehabDates.push(parsed)
        }
      }
      rehabDates.sort((a, b) => a.toMillis() - b.toMillis())
      const endDate = rehabDates.length > 0 ? rehabDates[rehabDates.length - 1] : null

      const contactType = mapContactType(classification || null)
      const baseDetails = `player=${player || 'N/A'} statsport_id=${statsportPlayerId || 'N/A'} injury="${injuryText || 'N/A'}" tissue=${tissue || 'N/A'} body_area=${bodyArea || 'N/A'} section=${section.name}${usedNa ? ' (N/A)' : ''} mechanism=${mechanism || 'N/A'} contact=${contactType || 'N/A'} start=${startDate?.toISODate() || 'N/A'} end=${endDate?.toISODate() || 'N/A'}`

      if (!athlete) {
        missingAthlete.push(baseDetails)
        continue
      }
      if (!injuryText) {
        missingLabel++
        missingLabelRows.push(baseDetails)
        continue
      }
      if (usedNa) {
        sectionNaRows.push(baseDetails)
      }
      if (!startDate) {
        missingStart.push(baseDetails)
        continue
      }
      if (!endDate) {
        missingEnd.push(baseDetails)
      }

      const { type: injuryType, created: typeCreated } = await resolveInjuryType(injuryText, section)
      if (typeCreated) {
        createdTypes++
        createdTypeRows.push(`${baseDetails} → type="${injuryType.name}"`)
      }

      const details = `${baseDetails} injury_type=${injuryType.name}${typeCreated ? ' (new)' : ''}`

      if (!injuryType.id) {
        created++
        createdRows.push(details)
        continue
      }

      const existingQuery = Injury.query()
        .where('athleteId', athlete.id)
        .where('dateOfInjury', startDate.toISODate()!)
        .where('typeOfInjuryId', injuryType.id)
        .where('pathology', pathology)
        .where('source', ATHLETE_PROVIDER_SOURCE.SAP)

      const existing = await existingQuery.first()

      if (existing) {
        skippedExisting++
        continue
      }

      const sapCandidates = await Injury.query()
        .where('athleteId', athlete.id)
        .where('source', ATHLETE_PROVIDER_SOURCE.SAP)
        .whereBetween('dateOfInjury', [
          startDate.minus({ days: 1 }).toISODate()!,
          startDate.plus({ days: 1 }).toISODate()!,
        ])
        .preload('injuryType')

      const sapDuplicates = sapCandidates.filter((injury) =>
        injuriesCoincide({
          dateA: startDate,
          dateB: injury.dateOfInjury,
          tissueA: tissue ?? bodyArea,
          tissueB: injury.tissue,
          pathologyA: pathology,
          pathologyB: injury.pathology,
          sectionIdA: section.id,
          sectionIdB: injury.injuryType?.categoryId ?? null,
        })
      )

      if (!this.dryRun) {
        for (const duplicate of sapDuplicates) {
          await duplicate.delete()
          replacedSap++
          replacedSapRows.push(`${baseDetails} removed_duplicate=${duplicate.id}`)
        }

        await Injury.create({
          athleteId: athlete.id,
          typeOfInjuryId: injuryType.id,
          dateOfInjury: startDate,
          recoveryDate: endDate,
          contactType,
          mechanism,
          tissue,
          pathology,
          source: ATHLETE_PROVIDER_SOURCE.SAP,
        })
      } else if (sapDuplicates.length > 0) {
        replacedSap += sapDuplicates.length
        for (const duplicate of sapDuplicates) {
          replacedSapRows.push(`${baseDetails} would_remove_duplicate=${duplicate.id}`)
        }
      }

      created++
      createdRows.push(details)
    }

    console.log('')
    console.log(`File: ${this.file}${this.dryRun ? ' (dry-run)' : ''}`)
    console.log(`Rows analyzed: ${total}`)
    console.log(`Created injuries: ${created}`)
    console.log(`Created injury types: ${createdTypes}`)
    console.log(`Skipped (already exists): ${skippedExisting}`)
    console.log(`Replaced SAP duplicates: ${replacedSap}`)
    console.log(`Missing athlete link: ${missingAthlete.length}`)
    console.log(`Missing injury label: ${missingLabel}`)
    console.log(`Section → N/A: ${sectionNaCount}`)
    console.log(`Missing start date: ${missingStart.length}`)
    console.log(`Missing end date (created with null recovery): ${missingEnd.length}`)

    const printSample = (title: string, rows: string[]) => {
      if (rows.length === 0) return
      console.log('')
      console.log(`${title} (showing ${Math.min(this.show, rows.length)}/${rows.length})`)
      for (const row of rows.slice(0, this.show)) {
        console.log(`  - ${row}`)
      }
    }

    printSample('Created injuries', createdRows)
    printSample('Created injury types', createdTypeRows)
    printSample('Replaced SAP duplicates', replacedSapRows)
    printSample('Missing athlete', missingAthlete)
    printSample('Missing injury label', missingLabelRows)
    printSample('Section → N/A', sectionNaRows)
    printSample('Missing start', missingStart)
    printSample('Missing end', missingEnd)
    console.log('')

    if (this.dryRun) {
      this.logger.info(`Dry run: would create ${created} injury(ies), ${createdTypes} type(s)`)
    } else {
      this.logger.success(`Imported ${created} injury(ies), ${createdTypes} type(s)`)
    }
  }
}
