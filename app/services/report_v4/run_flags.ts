import {
  isReportV4FreeDesignerEnabled,
  isReportV4FreeDesignerRefsEnabled,
} from '#services/report_v4/free_designer/flag'
import type { AppLanguage } from '#utils/localize'

export type ReportV4Path = 'free' | 'classic'

export type ReportV4RunFlags = {
  freeDesigner: boolean
  freeDesignerRefs: boolean
  lang: AppLanguage
  path: ReportV4Path
}

export const detectReportV4Path = (html?: string | null): ReportV4Path => {
  if (html && /data-artifact=["']free-designer["']/i.test(html)) return 'free'
  return 'classic'
}

export const resolveReportV4RunFlags = (args: {
  language: AppLanguage
  html?: string | null
}): ReportV4RunFlags => ({
  freeDesigner: isReportV4FreeDesignerEnabled(),
  freeDesignerRefs: isReportV4FreeDesignerRefsEnabled(),
  lang: args.language === 'en' ? 'en' : 'fr',
  path: detectReportV4Path(args.html),
})

export const formatReportV4RunFlagsLine = (flags: ReportV4RunFlags): string =>
  [
    `freeDesigner=${flags.freeDesigner ? 'on' : 'off'}`,
    `refs=${flags.freeDesignerRefs ? 'on' : 'off'}`,
    `lang=${flags.lang}`,
    `path=${flags.path}`,
  ].join(' · ')
