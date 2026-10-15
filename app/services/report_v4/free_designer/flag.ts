import { envFlag } from '#services/report_v4/env_flag'

export const isReportV4FreeDesignerEnabled = () => envFlag('REPORT_V4_FREE_DESIGNER', true)

export const isReportV4FreeDesignerRefsEnabled = () => envFlag('REPORT_V4_FREE_DESIGNER_REFS', true)
