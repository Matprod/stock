export {
  artifactContractsFromIntent,
  envelopeFromContracts,
  markLineValuesFromContracts,
  parseThresholdNumbers,
  resolveArtifactEnvelopeAsync,
  wantsDropEmptyDays,
  type ArtifactIntentFlags,
} from '#services/report_v4/artifact_runtime/classify_artifact_intent'
import {
  artifactContractsFromIntent,
  envelopeFromContracts,
  type ArtifactIntentFlags,
} from '#services/report_v4/artifact_runtime/classify_artifact_intent'
import type { ArtifactContracts, ArtifactEnvelope } from '#services/report_v4/artifact_runtime/types'

export const resolveArtifactContracts = (args: {
  flags: ArtifactIntentFlags
  prompt: string
  rosterNames?: string[]
  namedAthletes?: string[]
}): ArtifactContracts => artifactContractsFromIntent(args)

export const resolveArtifactEnvelope = (args: {
  flags: ArtifactIntentFlags
  prompt: string
  rosterNames?: string[]
  namedAthletes?: string[]
}): ArtifactEnvelope =>
  envelopeFromContracts(
    artifactContractsFromIntent({
      flags: args.flags,
      prompt: args.prompt,
      rosterNames: args.rosterNames,
      namedAthletes: args.namedAthletes,
    })
  )

export const analystPacketFromEnvelope = (envelope: ArtifactEnvelope) => ({
  mode: envelope.mode,
  athleteCoverage: envelope.contracts.athleteCoverage,
  requiredAthletes: envelope.coverage.requiredNames.length,
  requiredAthleteNames: envelope.coverage.requiredNames.slice(0, 40),
  vizOps: envelope.contracts.vizOps,
  requiredMetrics: envelope.harvest.requiredMetrics,
  individualSheets: envelope.coverage.individualSheets,
  softAllowed: envelope.contracts.softAllowed,
})
