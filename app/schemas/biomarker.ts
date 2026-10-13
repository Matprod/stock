import { BIOMARKER_TREND_MAX_ATHLETES } from '#contracts/biomarker'
import vine from '@vinejs/vine'

const MAX_BIOMARKER_BATCH_SIZE = 1000

export const getAllBiomarkersQuerySchema = vine.compile(
  vine.object({
    cursor: vine.number().optional(),
    athleteIds: vine.array(vine.string().trim().minLength(1)).optional(),
    biomarkerTypeId: vine.string().optional(),
    from: vine.string().optional(),
    to: vine.string().optional(),
  })
)

export const biomarkerTrendQuerySchema = vine.compile(
  vine.object({
    athleteIds: vine
      .array(vine.string().trim().minLength(1))
      .minLength(1)
      .maxLength(BIOMARKER_TREND_MAX_ATHLETES),
    biomarkerTypeId: vine.string(),
  })
)

const biomarkerPayload = vine.object({
  athleteId: vine.string(),
  biomarkerTypeId: vine.string(),
  value: vine.string().trim(),
  measuredAt: vine.date({ formats: ['iso8601'] }),
})

export const updateBiomarkerSchema = vine.compile(biomarkerPayload)

export const createBiomarkersSchema = vine.compile(
  vine.array(biomarkerPayload).minLength(1).maxLength(MAX_BIOMARKER_BATCH_SIZE)
)

export const biomarkerIdParams = vine.compile(
  vine.object({
    id: vine.string(),
  })
)
