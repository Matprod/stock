import router from '@adonisjs/core/services/router'
import { middleware } from './kernel.js'
import { externalThrottle } from '#start/limiter'
import { EXTERNAL_API_PREFIX } from '#constants/external_api.constants'

const ExternalAthletesController = () => import('#controllers/external/athletes_controller')
const ExternalScoresController = () => import('#controllers/external/scores_controller')
const ExternalDocsController = () => import('#controllers/external/docs_controller')

router
  .group(() => {
    router.get('/docs', [ExternalDocsController, 'ui'])
    router.get('/openapi.json', [ExternalDocsController, 'spec'])

    router
      .group(() => {
        router.get('/athletes', [ExternalAthletesController, 'index'])
        router.get('/scores', [ExternalScoresController, 'index'])
      })
      .use([middleware.externalApiKey(), externalThrottle])
  })
  .prefix(EXTERNAL_API_PREFIX)
