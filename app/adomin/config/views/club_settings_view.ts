import { createModelViewConfig } from '#adomin/create_model_view_config'
import ClubSettings from '#models_pg/club_settings'
import ThresholdsService from '#services/thresholds_service'
import { createRoleVisibilityCheck } from '../utils.js'

export const CLUB_SETTINGS_VIEW = createModelViewConfig(() => ClubSettings, {
  label: 'Club settings',
  icon: 'adjustments',
  visibilityCheck: createRoleVisibilityCheck([]),
  validation: {
    create: async (ctx) => {
      const body = ctx.request.all()

      const payload = {
        performance: {
          high: Number(body.performanceHigh),
          medium: Number(body.performanceMedium),
        },
        injury: {
          high: Number(body.injuryHigh),
          medium: Number(body.injuryMedium),
        },
        availability: {
          high: Number(body.availabilityHigh),
          medium: Number(body.availabilityMedium),
        },
      }

      const validationError = ThresholdsService.getThresholdsPayloadValidationError(payload)
      if (validationError) {
        return { valid: false, errorMessage: validationError }
      }

      return { valid: true }
    },
    update: async (ctx) => {
      const row = await ClubSettings.find(ctx.params.id)
      if (!row) {
        return { valid: false, errorMessage: 'Club settings row not found' }
      }

      const body = ctx.request.all()

      const payload = {
        performance: {
          high:
            body.performanceHigh !== undefined ? Number(body.performanceHigh) : row.performanceHigh,
          medium:
            body.performanceMedium !== undefined
              ? Number(body.performanceMedium)
              : row.performanceMedium,
        },
        injury: {
          high: body.injuryHigh !== undefined ? Number(body.injuryHigh) : row.injuryHigh,
          medium: body.injuryMedium !== undefined ? Number(body.injuryMedium) : row.injuryMedium,
        },
        availability: {
          high:
            body.availabilityHigh !== undefined
              ? Number(body.availabilityHigh)
              : row.availabilityHigh,
          medium:
            body.availabilityMedium !== undefined
              ? Number(body.availabilityMedium)
              : row.availabilityMedium,
        },
      }

      const validationError = ThresholdsService.getThresholdsPayloadValidationError(payload)
      if (validationError) {
        return { valid: false, errorMessage: validationError }
      }

      return { valid: true }
    },
  },
  columns: {
    club: {
      type: 'belongsToRelation',
      label: 'Club',
      modelName: 'Club',
      labelFields: ['name'],
      preload: true,
      optional: true,
    },
    performanceHigh: {
      type: 'number',
      label: 'Performance high',
    },
    performanceMedium: {
      type: 'number',
      label: 'Performance medium',
    },
    injuryHigh: {
      type: 'number',
      label: 'Injury high',
    },
    injuryMedium: {
      type: 'number',
      label: 'Injury medium',
    },
    availabilityHigh: {
      type: 'number',
      label: 'Availability high',
    },
    availabilityMedium: {
      type: 'number',
      label: 'Availability medium',
    },
  },
})
