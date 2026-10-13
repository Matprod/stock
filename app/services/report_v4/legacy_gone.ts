import type { AppLanguage } from '#utils/localize'

export const REPORT_V4_LEGACY_GONE_CODE = 'report_legacy_gone' as const

export const legacyReportGoneMessage = (language: AppLanguage): string =>
  language === 'en'
    ? 'This report endpoint is retired. Use Report v4 at /reports/report-v4.'
    : 'Cet endpoint de rapport est retiré. Utilisez Report v4 sur /reports/report-v4.'

export const legacyReportGoneBody = (language: AppLanguage) => ({
  code: REPORT_V4_LEGACY_GONE_CODE,
  message: legacyReportGoneMessage(language),
  replacement: '/reports/report-v4',
})
