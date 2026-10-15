import type { PremiumReportState } from '#services/premium_report/premium_report_tools'
import { prepareAddChart } from '#services/premium_report/tools_document_charts_add_prepare'
import {
  emitMultiScoreAddCharts,
  emitSingleAddChart,
  emitSplitLineAddCharts,
} from '#services/premium_report/tools_document_charts_add_emit'

export const executeAddChart = async (
  state: PremiumReportState,
  input: Record<string, unknown>
): Promise<string> => {
  const prepared = prepareAddChart(state, input)
  if (typeof prepared === 'string') return prepared

  const { dataset, chartType, scoreJobs, isLine, shouldSplit } = prepared

  if (dataset && chartType && scoreJobs && scoreJobs.length > 1) {
    return emitMultiScoreAddCharts({ state, input, prepared, scoreJobs })
  }

  if (dataset && chartType && isLine && shouldSplit) {
    return emitSplitLineAddCharts({ state, input, prepared })
  }

  return emitSingleAddChart({ state, input, prepared })
}
