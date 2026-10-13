import { ATHLETE_PROVIDER_TYPES } from '#constants/athlete_provider.constants'
import {
  PLAYER_MAPPING_SAP_SKILLCORNER_DFL_FILE,
} from '#constants/hambourg.constants'
import AthleteProvider from '#models_pg/athlete_provider'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

type MappingRow = {
  personId: string
  firstName: string
  lastName: string
  skillcornerId: string | null
  dflId: string | null
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

function parseMappingCsv(content: string): MappingRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length < 2) return []

  const header = parseCsvLine(lines[0]).map((cell) => cell.toLowerCase())
  const indexOf = (name: string) => header.indexOf(name)

  const personIdIdx = indexOf('personid')
  const firstNameIdx = indexOf('firstname')
  const lastNameIdx = indexOf('lastname')
  const skillcornerIdIdx = indexOf('skillcorner_id')
  const dflIdIdx = indexOf('dfl_id')

  if (personIdIdx < 0 || skillcornerIdIdx < 0 || dflIdIdx < 0) {
    throw new Error(
      'CSV must include PersonId, skillcorner_id and dfl_id columns'
    )
  }

  const rows: MappingRow[] = []
  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line)
    const personId = (cells[personIdIdx] ?? '').trim()
    if (!personId) continue

    const skillcornerRaw = (cells[skillcornerIdIdx] ?? '').trim()
    const dflRaw = (cells[dflIdIdx] ?? '').trim()

    rows.push({
      personId,
      firstName: firstNameIdx >= 0 ? (cells[firstNameIdx] ?? '').trim() : '',
      lastName: lastNameIdx >= 0 ? (cells[lastNameIdx] ?? '').trim() : '',
      skillcornerId: skillcornerRaw || null,
      dflId: dflRaw || null,
    })
  }

  return rows
}

export default class HambourgImportSkillcornerDflProviders extends BaseCommand {
  static commandName = 'hambourg:import-skillcorner-dfl-providers'
  static description =
    'Create SkillCorner + DFL athlete_providers from player_mapping_sap_skillcorner_dfl.csv (via SAP PersonId)'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({
    description: 'Path to mapping CSV',
    default: PLAYER_MAPPING_SAP_SKILLCORNER_DFL_FILE,
  })
  declare file: string

  @flags.boolean({
    description: 'Dry run — parse and resolve only, do not write providers',
  })
  declare dryRun: boolean

  @flags.number({
    description: 'Number of sample rows printed per category',
    default: 15,
  })
  declare show: number

  async run() {
    const absolutePath = this.file.startsWith('/')
      ? this.file
      : join(process.cwd(), this.file.replace(/^\.\//, ''))

    const content = await readFile(absolutePath, 'utf8')
    const rows = parseMappingCsv(content)

    const sapProviders = await AthleteProvider.query()
      .where('provider', ATHLETE_PROVIDER_TYPES.SAP)
      .whereNotNull('providerAthleteId')
      .preload('athlete')

    const athleteBySapPersonId = new Map(
      sapProviders
        .filter((provider) => provider.providerAthleteId && provider.athlete)
        .map((provider) => [provider.providerAthleteId!, provider.athlete])
    )

    let skillcornerCreated = 0
    let skillcornerUpdated = 0
    let skillcornerSkipped = 0
    let dflCreated = 0
    let dflUpdated = 0
    let dflSkipped = 0
    let missingAthlete = 0

    const missingAthleteRows: string[] = []
    const createdRows: string[] = []
    const updatedRows: string[] = []

    for (const row of rows) {
      const athlete = athleteBySapPersonId.get(row.personId)
      const label = `${row.firstName} ${row.lastName}`.trim() || row.personId

      if (!athlete) {
        missingAthlete++
        missingAthleteRows.push(
          `${label} personId=${row.personId} sk=${row.skillcornerId || '-'} dfl=${row.dflId || '-'}`
        )
        continue
      }

      if (row.skillcornerId) {
        const result = await this.upsertProvider({
          athleteId: athlete.id,
          provider: ATHLETE_PROVIDER_TYPES.SKILLCORNER,
          providerAthleteId: row.skillcornerId,
          dryRun: this.dryRun,
        })
        if (result === 'created') {
          skillcornerCreated++
          createdRows.push(`${label} skillcorner=${row.skillcornerId}`)
        } else if (result === 'updated') {
          skillcornerUpdated++
          updatedRows.push(`${label} skillcorner=${row.skillcornerId}`)
        } else {
          skillcornerSkipped++
        }
      }

      if (row.dflId) {
        const result = await this.upsertProvider({
          athleteId: athlete.id,
          provider: ATHLETE_PROVIDER_TYPES.DFL,
          providerAthleteId: row.dflId,
          dryRun: this.dryRun,
        })
        if (result === 'created') {
          dflCreated++
          createdRows.push(`${label} dfl=${row.dflId}`)
        } else if (result === 'updated') {
          dflUpdated++
          updatedRows.push(`${label} dfl=${row.dflId}`)
        } else {
          dflSkipped++
        }
      }
    }

    console.log('')
    console.log(`File: ${absolutePath}${this.dryRun ? ' (dry-run)' : ''}`)
    console.log(`Rows: ${rows.length}`)
    console.log(`Missing SAP athlete link: ${missingAthlete}`)
    console.log(
      `SkillCorner: created=${skillcornerCreated} updated=${skillcornerUpdated} unchanged=${skillcornerSkipped}`
    )
    console.log(`DFL: created=${dflCreated} updated=${dflUpdated} unchanged=${dflSkipped}`)

    const printSample = (title: string, samples: string[]) => {
      if (samples.length === 0) return
      console.log('')
      console.log(`${title} (showing ${Math.min(this.show, samples.length)}/${samples.length})`)
      for (const sample of samples.slice(0, this.show)) {
        console.log(`  - ${sample}`)
      }
    }

    printSample('Created', createdRows)
    printSample('Updated', updatedRows)
    printSample('Missing athlete (no SAP provider for PersonId)', missingAthleteRows)
    console.log('')

    if (this.dryRun) {
      this.logger.info(
        `Dry run: would create ${skillcornerCreated + dflCreated}, update ${skillcornerUpdated + dflUpdated}`
      )
    } else {
      this.logger.success(
        `SkillCorner +${skillcornerCreated}/~${skillcornerUpdated}, DFL +${dflCreated}/~${dflUpdated}`
      )
    }
  }

  private async upsertProvider(input: {
    athleteId: string
    provider: (typeof ATHLETE_PROVIDER_TYPES)[keyof typeof ATHLETE_PROVIDER_TYPES]
    providerAthleteId: string
    dryRun: boolean
  }): Promise<'created' | 'updated' | 'unchanged'> {
    const existing = await AthleteProvider.query()
      .where('athleteId', input.athleteId)
      .where('provider', input.provider)
      .first()

    if (!existing) {
      if (!input.dryRun) {
        await AthleteProvider.create({
          athleteId: input.athleteId,
          provider: input.provider,
          providerAthleteId: input.providerAthleteId,
        })
      }
      return 'created'
    }

    if (existing.providerAthleteId === input.providerAthleteId) {
      return 'unchanged'
    }

    if (!input.dryRun) {
      existing.providerAthleteId = input.providerAthleteId
      await existing.save()
    }
    return 'updated'
  }
}
