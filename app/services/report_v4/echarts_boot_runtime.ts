import {
  echartsBootPreludeSource,
  echartsBootTailSource,
} from '#services/report_v4/echarts_boot_runtime_prelude'
import { echartsBootBootSource } from '#services/report_v4/echarts_boot_runtime_boot'

export type EchartsBootRuntimeArgs = {
  chartBoot: string
  paletteJson: string
  fontFamilyJson: string
  inkJson: string
  injectMissingHosts: boolean
  stripLineSymbols: boolean
}

export const buildEchartsBootIife = (args: EchartsBootRuntimeArgs): string => {
  const prelude = echartsBootPreludeSource(args)
  const boot = echartsBootBootSource()
  const tail = echartsBootTailSource()
  return `(function () {
${prelude}

${boot}
${tail}
})();`
}
