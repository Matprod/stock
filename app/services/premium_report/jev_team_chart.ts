import logger from '@adonisjs/core/services/logger'
import type { PremiumJevProvider } from '#constants/premium_report.constants'
import { JEV_ROUTER_MODEL } from '#constants/question_router.constants'
import { elapsedSec, logPremiumJev } from '#services/premium_report/premium_report_log'
import {
  teamSeriesLabel,
  type TeamChartOp,
} from '#services/premium_report/team_chart'
import JevService, { choice } from '#services/jev_service'
import type { AppLanguage } from '#utils/localize'

const OP_KEY = 'teamOp'
const LABEL_KEY = 'seriesLabel'

const TEAM_OP_CRITERIA: Record<TeamChartOp, string> = {
  mean: 'Squad daily average across athletes (moyenne / mean / average / typical player load).',
  sum: 'Squad daily total / cumulative volume across athletes (somme / total / Σ / collective volume).',
}

const TEAM_LABEL_CRITERIA_FR: Record<string, string> = {
  'Équipe (moy.)': 'Légende courte pour une moyenne d’équipe jour par jour',
  'Équipe (Σ)': 'Légende courte pour une somme / total d’équipe jour par jour',
  'Moyenne équipe': 'Formulation un peu plus longue pour la moyenne collective',
  'Charge équipe': 'Quand la métrique est clairement une charge / player load collective',
}

const TEAM_LABEL_CRITERIA_EN: Record<string, string> = {
  'Team (mean)': 'Short legend for squad daily mean',
  'Team (Σ)': 'Short legend for squad daily sum / total',
  'Team average': 'Slightly longer wording for squad mean',
  'Team load': 'When the metric is clearly collective load / player load',
}

type JevTeamChartJudgment = {
  op: TeamChartOp
  seriesLabel: string
  score: number
  provider: PremiumJevProvider
}

const heuristicTeamChart = (
  language: AppLanguage,
  request: string,
  forcedOp?: TeamChartOp
): JevTeamChartJudgment => {
  const text = request.toLowerCase()
  const wantsSum = /\b(somme|total|Σ|sum|cumulative|volume collectif)\b/i.test(text)
  const op: TeamChartOp = forcedOp ?? (wantsSum ? 'sum' : 'mean')
  return {
    op,
    seriesLabel: teamSeriesLabel(language, op),
    score: 1,
    provider: 'heuristic',
  }
}

export const jevTeamChart = async (args: {
  request: string
  language: AppLanguage
  chartTitles?: string[]
  op?: TeamChartOp
  seriesLabel?: string
}): Promise<JevTeamChartJudgment> => {
  const started = Date.now()
  const forcedOp = args.op
  const forcedLabel = args.seriesLabel?.trim()
  const fallback = heuristicTeamChart(args.language, args.request, forcedOp)

  const finish = (
    judgment: JevTeamChartJudgment,
    provider: PremiumJevProvider,
    detail: string
  ): JevTeamChartJudgment => {
    logPremiumJev({
      kind: 'team_chart',
      durationSec: elapsedSec(started),
      ok: true,
      decision: `${judgment.op}|${judgment.seriesLabel}`,
      score: judgment.score,
      provider,
      detail,
    })
    return { ...judgment, provider }
  }

  if (forcedOp) {
    return finish(
      {
        op: forcedOp,
        seriesLabel: forcedLabel || fallback.seriesLabel,
        score: 1,
        provider: 'heuristic',
      },
      'heuristic',
      'op-provided'
    )
  }

  const client = JevService.getClient()
  if (!client) {
    const label = forcedLabel || fallback.seriesLabel
    return finish(
      { op: forcedOp ?? fallback.op, seriesLabel: label, score: 1, provider: 'heuristic' },
      'skip',
      'no-client'
    )
  }

  const labelCriteria =
    args.language === 'fr' ? TEAM_LABEL_CRITERIA_FR : TEAM_LABEL_CRITERIA_EN
  const titles = (args.chartTitles ?? []).slice(0, 8).join(' · ').slice(0, 240)

  try {
    const response = await client.systemOne({
      model: JEV_ROUTER_MODEL,
      state: {
        request: args.request.slice(0, 500),
        language: args.language,
        chartTitles: titles || '(none)',
        forcedOp: forcedOp ?? '',
        forcedLabel: forcedLabel ?? '',
      },
      questions: {
        [OP_KEY]: choice(
          {
            question:
              'For `request` (and `chartTitles`), should individual athlete evolutions collapse to a squad daily mean or a squad daily sum?',
            note: forcedOp
              ? `Tool suggested ${forcedOp} — confirm or override if the coach wording clearly differs.`
              : 'Pick exactly one option.',
          },
          TEAM_OP_CRITERIA
        ),
        [LABEL_KEY]: choice(
          {
            question:
              'Which short legend label best fits the team series for `request` / `chartTitles` in the report language?',
            note: forcedLabel
              ? `Tool suggested "${forcedLabel}" — confirm the best legend among the options.`
              : 'Pick exactly one option.',
          },
          labelCriteria
        ),
      },
    })

    const opAnswer = response.answers[OP_KEY] as
      | { choice?: string; confidence?: number }
      | undefined
    const labelAnswer = response.answers[LABEL_KEY] as
      | { choice?: string; confidence?: number }
      | undefined

    const pickedOp =
      opAnswer?.choice === 'sum' || opAnswer?.choice === 'mean'
        ? (opAnswer.choice as TeamChartOp)
        : (forcedOp ?? fallback.op)

    const pickedLabel =
      labelAnswer?.choice && labelCriteria[labelAnswer.choice]
        ? labelAnswer.choice
        : forcedLabel || teamSeriesLabel(args.language, pickedOp)

    const score = Math.max(opAnswer?.confidence ?? 0, labelAnswer?.confidence ?? 0, 0.5)

    return finish(
      { op: pickedOp, seriesLabel: pickedLabel, score, provider: 'jev' },
      'jev',
      `titles=${titles.slice(0, 80) || '—'}`
    )
  } catch (error) {
    logger.warn({ err: error }, 'premium_report.team_chart_jev_failed')
    return finish(
      {
        op: forcedOp ?? fallback.op,
        seriesLabel: forcedLabel || fallback.seriesLabel,
        score: 1,
        provider: 'fallback',
      },
      'fallback',
      error instanceof Error ? error.message.slice(0, 80) : 'error'
    )
  }
}
