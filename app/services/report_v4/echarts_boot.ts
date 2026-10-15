import { echartsLocalScriptTag } from '#services/report_v4/report_v4_assets'
import { buildEchartsBootIife } from '#services/report_v4/echarts_boot_runtime'

type EchartsBootChart = {
  id: string
  title?: string
  option: Record<string, unknown>
}

type EchartsBootTheme = {
  palette: string[]
  fontFamily: string
  ink: string
}

const escapeForScript = (json: string): string => json.replace(/</g, '\\u003c')

export const echartsCdnScriptTag = (): string => echartsLocalScriptTag()

export const buildEchartsBootScript = (args: {
  charts: EchartsBootChart[]
  theme: EchartsBootTheme
  injectMissingHosts?: boolean
  stripLineSymbols?: boolean
  scriptId?: string
}): string => {
  const chartBoot = escapeForScript(JSON.stringify(args.charts))
  const scriptId = args.scriptId ?? 'mauna-artifact-boot'
  const injectMissingHosts = Boolean(args.injectMissingHosts)
  const stripLineSymbols = Boolean(args.stripLineSymbols)
  const iife = buildEchartsBootIife({
    chartBoot,
    paletteJson: JSON.stringify(args.theme.palette),
    fontFamilyJson: JSON.stringify(args.theme.fontFamily),
    inkJson: JSON.stringify(args.theme.ink),
    injectMissingHosts,
    stripLineSymbols,
  })
  return `<script id="${scriptId}">
${iife}
</script>`
}
