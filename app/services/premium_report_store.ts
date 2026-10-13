import { Exception } from '@adonisjs/core/exceptions'
import { DateTime } from 'luxon'
import { PREMIUM_REPORT_HISTORY_MAX } from '#constants/premium_report.constants'
import type {
  PremiumReportDocument,
  PremiumReportDocumentDraft,
  PremiumReportHistoryTurn,
} from '#contracts/premium_report'
import { sanitizeIncomingDocument } from '#services/premium_report/premium_report_document'
import PremiumReport from '#models_pg/premium_report'
import type { AppLanguage } from '#utils/localize'

export type SavedPremiumReport = {
  id: string
  title: string
  dateRange: { from: string; to: string }
  document: PremiumReportDocument
  history: PremiumReportHistoryTurn[]
  createdAt: string | null
  updatedAt: string | null
}

export type SavedPremiumReportSummary = Omit<SavedPremiumReport, 'document' | 'history'>

const isoDate = (value: DateTime): string => value.toISODate() ?? value.toFormat('yyyy-MM-dd')

const toSaved = (row: PremiumReport): SavedPremiumReport => ({
  id: row.id,
  title: row.title,
  dateRange: { from: isoDate(row.dateFrom), to: isoDate(row.dateTo) },
  document: row.document,
  history: row.history ?? [],
  createdAt: row.createdAt?.toISO() ?? null,
  updatedAt: row.updatedAt?.toISO() ?? null,
})

const toSummary = (row: PremiumReport): SavedPremiumReportSummary => {
  const saved = toSaved(row)
  return {
    id: saved.id,
    title: saved.title,
    dateRange: saved.dateRange,
    createdAt: saved.createdAt,
    updatedAt: saved.updatedAt,
  }
}

export default class PremiumReportStore {
  async list(clubId: string, userId: string): Promise<SavedPremiumReportSummary[]> {
    const rows = await PremiumReport.query()
      .where('clubId', clubId)
      .where('userId', userId)
      .orderBy('updatedAt', 'desc')
      .select('id', 'title', 'dateFrom', 'dateTo', 'createdAt', 'updatedAt')
    return rows.map(toSummary)
  }

  async get(clubId: string, id: string): Promise<SavedPremiumReport> {
    const row = await this.find(clubId, id)
    return toSaved(row)
  }

  async create(args: {
    clubId: string
    userId: string
    title?: string
    document: PremiumReportDocumentDraft
    history?: PremiumReportHistoryTurn[]
    language?: AppLanguage
  }): Promise<SavedPremiumReport> {
    const document = sanitizeIncomingDocument(args.document, args.document.dateRange, args.language)
    const row = await PremiumReport.create({
      clubId: args.clubId,
      userId: args.userId,
      title: (args.title?.trim() || document.title || 'Report').slice(0, 200),
      dateFrom: DateTime.fromISO(document.dateRange.from),
      dateTo: DateTime.fromISO(document.dateRange.to),
      document,
      history: (args.history ?? []).slice(-PREMIUM_REPORT_HISTORY_MAX),
    })
    return toSaved(row)
  }

  async update(
    clubId: string,
    id: string,
    args: {
      title?: string
      document?: PremiumReportDocument | PremiumReportDocumentDraft
      history?: PremiumReportHistoryTurn[]
      language?: AppLanguage
    }
  ): Promise<SavedPremiumReport> {
    const row = await this.find(clubId, id)
    if (args.title?.trim()) row.title = args.title.trim().slice(0, 200)
    if (args.document) {
      const previousTitle = row.document.title
      const document = sanitizeIncomingDocument(
        args.document,
        args.document.dateRange,
        args.language
      )
      row.document = document
      row.dateFrom = DateTime.fromISO(document.dateRange.from)
      row.dateTo = DateTime.fromISO(document.dateRange.to)
      if (!args.title?.trim() && document.title.trim() && row.title === previousTitle) {
        row.title = document.title.trim().slice(0, 200)
      }
    }
    if (args.history) row.history = args.history.slice(-PREMIUM_REPORT_HISTORY_MAX)
    await row.save()
    return toSaved(row)
  }

  async remove(clubId: string, id: string): Promise<void> {
    const row = await this.find(clubId, id)
    await row.delete()
  }

  async find(clubId: string, id: string): Promise<PremiumReport> {
    const row = await PremiumReport.query().where('clubId', clubId).where('id', id).first()
    if (!row) throw new Exception('Report not found', { status: 404 })
    return row
  }
}
