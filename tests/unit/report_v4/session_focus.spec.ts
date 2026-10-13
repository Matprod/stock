import { test } from '@japa/runner'
import { PREMIUM_DOMAIN } from '#constants/premium_report_domains'
import {
  buildSessionFocus,
  clampFetchesToSessionFocus,
  normalizeSessionFocus,
  priorUserAsks,
} from '#services/report_v4/session_focus'
import { heuristicNeedsFetch } from '#services/report_v4/edit_route'

test.group('report_v4 session_focus', () => {
  test('normalizeSessionFocus accepts domains + fetches', ({ assert }) => {
    const focus = normalizeSessionFocus({
      lastPrompt: 'injury list this season',
      domains: [PREMIUM_DOMAIN.INJURY],
      fetches: [
        {
          domain: PREMIUM_DOMAIN.INJURY,
          from: '2026-07-01',
          to: '2026-10-08',
          label: 'season',
        },
      ],
      displayRange: { from: '2026-07-01', to: '2026-10-08' },
    })
    assert.isNotNull(focus)
    assert.deepEqual(focus?.domains, [PREMIUM_DOMAIN.INJURY])
    assert.equal(focus?.fetches.length, 1)
  })

  test('priorUserAsks returns last 2 user turns', ({ assert }) => {
    const asks = priorUserAsks(
      [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'ok' },
        { role: 'user', content: 'second' },
        { role: 'assistant', content: 'ok2' },
        { role: 'user', content: 'third' },
      ],
      2
    )
    assert.deepEqual(asks, ['second', 'third'])
  })

  test('clampFetchesToSessionFocus keeps injury on period follow-up', ({ assert }) => {
    const focus = buildSessionFocus({
      prompt: 'injury list',
      domains: [PREMIUM_DOMAIN.INJURY],
      fetches: [
        { domain: PREMIUM_DOMAIN.INJURY, from: '2026-07-01', to: '2026-10-08' },
      ],
      displayRange: { from: '2026-07-01', to: '2026-10-08' },
    })
    const clamped = clampFetchesToSessionFocus(
      [
        { domain: PREMIUM_DOMAIN.LOAD, from: '2025-06-01', to: '2026-05-24' },
        { domain: PREMIUM_DOMAIN.WELLNESS, from: '2025-06-01', to: '2026-05-24' },
        { domain: PREMIUM_DOMAIN.INJURY, from: '2025-06-01', to: '2026-05-24' },
      ],
      focus,
      [],
      true
    )
    assert.deepEqual(
      clamped.map((row) => row.domain),
      [PREMIUM_DOMAIN.INJURY]
    )
  })
})

test.group('report_v4 edit_route needsFetchFromSignals', () => {
  test('forces fetch for sessionFocus data ask and skips aesthetic', ({ assert }) => {
    assert.isTrue(
      heuristicNeedsFetch({
        aesthetic: false,
        design: false,
        additive: false,
        scopedPeriod: false,
        periodChanged: false,
        multiSectionAsk: false,
        windowFetchDomains: [PREMIUM_DOMAIN.INJURY],
        sessionFocus: {
          lastPrompt: 'injury list',
          domains: [PREMIUM_DOMAIN.INJURY],
          fetches: [],
          displayRange: { from: '2026-07-01', to: '2026-10-08' },
        },
      })
    )
    assert.isFalse(
      heuristicNeedsFetch({
        aesthetic: true,
        design: true,
        additive: false,
        scopedPeriod: false,
        periodChanged: false,
        multiSectionAsk: false,
        windowFetchDomains: [],
        sessionFocus: {
          lastPrompt: 'injury list',
          domains: [PREMIUM_DOMAIN.INJURY],
          fetches: [],
          displayRange: { from: '2026-07-01', to: '2026-10-08' },
        },
      })
    )
  })
})
