import {
  countPresentChartHosts,
  freeArtifactTooThinForCharts,
  injectMissingChartHostShells,
  listMissingArtifactChartHosts,
  type ArtifactChartSpec,
} from '#services/report_v4/artifact_html'

export type HostHealResult = {
  html: string
  healed: boolean
  injected: number
  missingBefore: string[]
  missingAfter: string[]
  tooThin: boolean
}

export const healMissingChartHosts = (args: {
  html: string
  charts: ArtifactChartSpec[]
}): HostHealResult => {
  const missingBefore = listMissingArtifactChartHosts(args.html, args.charts)
  if (missingBefore.length === 0) {
    return {
      html: args.html,
      healed: false,
      injected: 0,
      missingBefore: [],
      missingAfter: [],
      tooThin: false,
    }
  }

  const presentBefore = countPresentChartHosts(args.html, args.charts)
  const tooThin = freeArtifactTooThinForCharts({
    chartCount: args.charts.length,
    injectedCharts: missingBefore.length,
    presentHosts: presentBefore,
  })
  if (tooThin) {
    return {
      html: args.html,
      healed: false,
      injected: 0,
      missingBefore,
      missingAfter: missingBefore,
      tooThin: true,
    }
  }

  const injected = injectMissingChartHostShells(args.html, args.charts)
  const missingAfter = listMissingArtifactChartHosts(injected.html, args.charts)
  return {
    html: injected.html,
    healed: injected.injected > 0 && missingAfter.length === 0,
    injected: injected.injected,
    missingBefore,
    missingAfter,
    tooThin: false,
  }
}

export const shouldAttemptHostHeal = (args: {
  missingHosts: string[]
  proseMiss: boolean
  editorialGatesOk: boolean
}): boolean =>
  args.editorialGatesOk && !args.proseMiss && args.missingHosts.length > 0
