import { test } from '@japa/runner'
import { PREMIUM_DOMAIN } from '#constants/premium_report_domains'
import {
  resolveFreshClarify,
  resolveSoftClarify,
} from '#services/report_v4/artifact_runtime/clarify'
import { resolveArtifactEnvelope } from '#services/report_v4/artifact_runtime/resolve'

test.group('report_v4 clarify (free-text ask)', () => {
  test('fresh: explicit period + domains → no ask', ({ assert }) => {
    const gate = resolveFreshClarify({
      language: 'fr',
      preserveCanvas: false,
      askRound: 0,
      explicitPeriod: true,
      askDomains: [PREMIUM_DOMAIN.LOAD],
      preferredDomains: [],
    })
    assert.isFalse(gate.needsClarify)
  })

  test('fresh: missing period lists it and asks in writing', ({ assert }) => {
    const gate = resolveFreshClarify({
      language: 'fr',
      preserveCanvas: false,
      askRound: 0,
      explicitPeriod: false,
      askDomains: [PREMIUM_DOMAIN.SCORES],
      preferredDomains: [],
    })
    assert.isTrue(gate.needsClarify)
    assert.include(gate.markdown, 'période')
    assert.include(gate.markdown, 'écrit')
    assert.isFalse(JSON.stringify(gate).includes('choices'))
  })

  test('fresh: unclear domains listed', ({ assert }) => {
    const gate = resolveFreshClarify({
      language: 'en',
      preserveCanvas: false,
      askRound: 0,
      explicitPeriod: true,
      askDomains: [],
      preferredDomains: [],
    })
    assert.isTrue(gate.needsClarify)
    assert.include(gate.markdown, 'data')
  })

  test('fresh: askRound blocks re-ask', ({ assert }) => {
    const gate = resolveFreshClarify({
      language: 'fr',
      preserveCanvas: false,
      askRound: 1,
      explicitPeriod: false,
      askDomains: [],
      preferredDomains: [],
    })
    assert.isFalse(gate.needsClarify)
  })

  test('soft: unresolved targets mention candidates, no buttons', ({ assert }) => {
    const envelope = resolveArtifactEnvelope({
      flags: {
        allAthletes: false,
        dropEmptyDays: false,
        wantsThresholds: false,
        stripVisualMap: false,
        remapEncode: false,
        chartAcwr: false,
        mentionAcwr: true,
        strengthenTitle: false,
        accentBand: false,
        tightenSpacing: false,
        emphasizeCaptions: false,
      },
      prompt: 'Improve the ACWR chart a bit',
    })
    const clarify = resolveSoftClarify({
      prompt: 'Improve the ACWR chart a bit',
      envelope,
      preserveCanvas: true,
      softTargetsUnresolved: true,
      candidateTitles: ['ACWR EWMA', 'Load mean'],
      softOps: null,
      language: 'fr',
    })
    assert.isTrue(clarify.needsClarify)
    assert.include(clarify.markdown, 'ACWR EWMA')
    assert.notInclude(clarify.markdown, '   - ')
  })

  test('soft: concrete ops skip ask', ({ assert }) => {
    const envelope = resolveArtifactEnvelope({
      flags: {
        allAthletes: false,
        dropEmptyDays: false,
        wantsThresholds: true,
        stripVisualMap: false,
        remapEncode: false,
        chartAcwr: false,
        mentionAcwr: true,
        strengthenTitle: false,
        accentBand: false,
        tightenSpacing: false,
        emphasizeCaptions: false,
      },
      prompt: 'Add ACWR thresholds 0.6 and 1.3',
    })
    const clarify = resolveSoftClarify({
      prompt: 'Add ACWR thresholds 0.6 and 1.3',
      envelope,
      preserveCanvas: true,
      softTargetsUnresolved: false,
      softOps: null,
      language: 'fr',
    })
    assert.isFalse(clarify.needsClarify)
  })
})
