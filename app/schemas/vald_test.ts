import { VALD_TREND_MAX_ATHLETES } from '#contracts/vald_test_list'
import vine from '@vinejs/vine'

const athleteIds = () => vine.array(vine.string().trim().minLength(1))

export const listValdTestsQuerySchema = vine.compile(
  vine.object({
    cursor: vine.number().optional(),
    athleteIds: athleteIds().optional(),
    from: vine.string().optional(),
    to: vine.string().optional(),
    testType: vine.string().optional(),
  })
)

export const valdTestTypesQuerySchema = vine.compile(
  vine.object({
    athleteIds: athleteIds().optional(),
    from: vine.string().optional(),
    to: vine.string().optional(),
  })
)

export const valdTrendQuerySchema = vine.compile(
  vine.object({
    athleteIds: athleteIds().minLength(1).maxLength(VALD_TREND_MAX_ATHLETES),
    testType: vine.string(),
  })
)
