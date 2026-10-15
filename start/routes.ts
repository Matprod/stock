

import AthletesController from '#controllers/athletes_controller'
import AgentController from '#controllers/agent_controller'
import '#adomin/routes/adomin_router'
import './mobile_routes.js'
import router from '@adonisjs/core/services/router'
import { middleware } from './kernel.js'
import AuthController from '#controllers/auth_controller'
import ChatbotsController from '#controllers/chatbots_controller'
import InjuryController from '#controllers/injury_controller'
import BiomarkerController from '#controllers/biomarker_controller'
import ValdTestsController from '#controllers/vald_tests_controller'
import PlayerChatbotsController from '#controllers/player_chatbots_controller'
import TeamChatbotsController from '#controllers/team_chatbots_controller'
import MyCoachController from '#controllers/my_coach_controller'
import CronsController from '#controllers/crons_controller'
import NotesController from '#controllers/notes_controller'
import WorkoutsController from '#controllers/workouts_controller'
import SummariesController from '#controllers/summaries_controller'
import NutritionController from '#controllers/nutrition_controller'
import BasketballController from '#controllers/basketball_controller'
import SportActivityController from '#controllers/sport_activity_controller'
import CalendarController from '#controllers/calendar_controller'
import { queueDashUiRoutes } from '@nemoventures/adonis-jobs/ui/queuedash'
import WebhooksController from '#controllers/webhooks_controller'
import PainsController from '#controllers/pains_controller'
import DiseasesController from '#controllers/diseases_controller'
import TmpsController from '#controllers/tmps_controller'
import HealthPainsController from '#controllers/health_pains_controller'
import SleepController from '#controllers/sleep_controller'
import HealthController from '#controllers/health_controller'
import SubjectiveScalesController from '#controllers/subjective_scales_controller'
import ThresholdsController from '#controllers/thresholds_controller'
import DemoPairsController from '#controllers/demo_pairs_controller'
import WahooOauthController from '#controllers/mobile/wahoo_oauth_controller'
import WhoopOauthController from '#controllers/mobile/whoop_oauth_controller'

router.get('/', async () => {
  return {
    app: 'is running !',
  }
})

router.get('/wahoo/callback', [WahooOauthController, 'callback'])
router.get('/whoop/callback', [WhoopOauthController, 'callback'])

router
  .group(() => {
    router.post('login', [AuthController, 'login'])
    router.post('logout', [AuthController, 'logout'])
    router.get('user', [AuthController, 'user']).use(middleware.auth())
    router.post('forgot-password/send-otp', [AuthController, 'sendForgotPasswordOtp'])
    router.post('forgot-password/verify-otp', [AuthController, 'verifyForgotPasswordOtp'])
    router.post('forgot-password/reset', [AuthController, 'resetPassword'])
  })
  .prefix('/auth')

router
  .group(() => {
    router.get('/team-list', [AthletesController, 'teamList'])
    router
      .get('/seasons', [AthletesController, 'getSeasons'])
      .use(middleware.permission('season:view'))
    router.get('/:id/insights', [AthletesController, 'insights'])
    router.post('/:id/profile-picture', [AthletesController, 'uploadProfilePicture'])
    router.get('/:id', [AthletesController, 'getOne'])
    router.get('/', [AthletesController, 'list'])
  })
  .prefix('/athletes')
  .middleware(middleware.auth())

router
  .group(() => {
    router.post('/chat', [AgentController, 'chat'])
  })
  .prefix('/agent')
  .middleware(middleware.auth())

router
  .group(() => {
    router.get('/:athleteId/meals-filled', [NutritionController, 'getMealsFilled'])
    router.get('/:athleteId/nutrition-detail', [NutritionController, 'getNutritionDetail'])
  })
  .prefix('/nutritions')
  .middleware(middleware.auth())

router
  .group(() => {
    router.post('/', [NotesController, 'addNote']).use(middleware.permission('notes:create'))
    router
      .put('/:noteId', [NotesController, 'updateNote'])
      .use(middleware.permission('notes:update'))
    router.get('/', [NotesController, 'getAllNotes'])
    router
      .delete('/:noteId', [NotesController, 'deleteNote'])
      .use(middleware.permission('notes:delete'))
  })
  .prefix('/notes')
  .middleware(middleware.auth())
  .middleware(middleware.permission('notes:view'))

const ReportV4Controller = () => import('#services/report_v4/controller')
router.get('/reports/report-v4/assets/echarts.min.js', [ReportV4Controller, 'echartsAsset'])
router
  .group(() => {
    router
      .post('/generate', [ReportV4Controller, 'generate'])
      .use(middleware.permission('reports-premium:create'))
    router
      .post('/export-pdf', [ReportV4Controller, 'exportPdf'])
      .use(middleware.permission('reports-premium:create'))
    router
      .post('/coverage', [ReportV4Controller, 'coverage'])
      .use(middleware.permission('reports-premium:view'))
  })
  .prefix('/reports/report-v4')
  .middleware(middleware.auth())
  .middleware(middleware.permission('reports-premium:view'))

router
  .group(() => {
    router.get('/workout-exercices', [WorkoutsController, 'getAllWorkoutExercices'])
    router.put('/workout-exercices/:exerciseId/favorite', [
      WorkoutsController,
      'toggleExerciseFavorite',
    ])
    router
      .get('/', [WorkoutsController, 'getAllWorkouts'])
      .use(middleware.permission('workouts-list:view'))
    router
      .post('/', [WorkoutsController, 'createWorkout'])
      .use(middleware.permission('workouts:create'))
    router
      .post('/start', [WorkoutsController, 'startWorkout'])
      .use(middleware.permission('workouts:start'))
    router
      .delete('/:workoutId', [WorkoutsController, 'deleteWorkout'])
      .use(middleware.permission('workouts:delete'))
    router
      .get('/history', [WorkoutsController, 'getWorkoutsHistory'])
      .use(middleware.permission('workouts-history:view'))
  })
  .prefix('/workouts')
  .middleware(middleware.auth())

router
  .group(() => {
    router
      .group(() => {
        router.get('/types', [InjuryController, 'getInjuryTypes'])
        router
          .get('/', [InjuryController, 'getAll'])
          .use(middleware.permission(['injuries-section:view', 'injuries-tab:view']))
        router
          .post('/', [InjuryController, 'upsertInjury'])
          .use(middleware.permission('injuries:create'))
        router
          .put('/:id', [InjuryController, 'upsertInjury'])
          .use(middleware.permission('injuries:update'))
        router
          .delete('/:id', [InjuryController, 'deleteInjury'])
          .use(middleware.permission('injuries:delete'))
      })
      .prefix('/injuries')

    router
      .group(() => {
        router
          .get('/', [DiseasesController, 'getAll'])
          .use(middleware.permission('diseases-tab:view'))
        router
          .post('/', [DiseasesController, 'upsertDisease'])
          .use(middleware.permission('diseases:create'))
        router
          .put('/:id', [DiseasesController, 'upsertDisease'])
          .use(middleware.permission('diseases:update'))
        router
          .delete('/:id', [DiseasesController, 'deleteDisease'])
          .use(middleware.permission('diseases:delete'))
      })
      .prefix('/diseases')

    router
      .group(() => {
        router
          .get('/types', [BiomarkerController, 'getBiomarkerTypes'])
          .use(middleware.permission('biomarkers:view'))
        router
          .get('/trend', [BiomarkerController, 'getTrend'])
          .use(middleware.permission('biomarkers:view'))
        router
          .get('/', [BiomarkerController, 'getAll'])
          .use(middleware.permission('biomarkers:view'))
        router
          .post('/', [BiomarkerController, 'createBiomarkers'])
          .use(middleware.permission('biomarkers:create'))
        router
          .put('/:id', [BiomarkerController, 'updateBiomarker'])
          .use(middleware.permission('biomarkers:update'))
        router
          .delete('/:id', [BiomarkerController, 'deleteBiomarker'])
          .use(middleware.permission('biomarkers:delete'))
      })
      .prefix('/biomarkers')

    router
      .group(() => {
        router.get('/types', [ValdTestsController, 'getTypes'])
        router.get('/trend', [ValdTestsController, 'getTrend'])
        router.get('/', [ValdTestsController, 'getAll'])
      })
      .prefix('/test-valds')
      .use(middleware.permission('biomarkers:view'))

    router
      .group(() => {
        router
          .get('/', [HealthPainsController, 'getAllPains'])
          .use(middleware.permission('pains-section:view'))
      })
      .prefix('/pains')
  })
  .prefix('/health')
  .middleware(middleware.auth())

router
  .group(() => {
    router.post('/generate-response', [ChatbotsController, 'generateResponse'])
    router.delete('/discussions/:id', [ChatbotsController, 'deleteDiscussion'])
    router.get('/discussions/:discussionId/messages', [ChatbotsController, 'getMessages'])
    router.get('/discussions/:athleteId', [ChatbotsController, 'getDiscussions'])
    router.get('/questions', [ChatbotsController, 'getQuestions'])
    router.get('/report', [ChatbotsController, 'getReport'])
    router
      .post('/report/generate', [ChatbotsController, 'generateDailyReports'])
      .use(middleware.permission('chatbot-reports-daily:generate'))
  })
  .prefix('/chatbots')
  .middleware(middleware.auth())
  .middleware(middleware.permission('chatbot-athlete:view'))

router
  .group(() => {
    router.post('/generate-response', [PlayerChatbotsController, 'generateResponse'])
    router.get('/discussions', [PlayerChatbotsController, 'getDiscussions'])
    router.get('/discussions/:discussionId/messages', [PlayerChatbotsController, 'getMessages'])
    router.get('/recommended-questions', [PlayerChatbotsController, 'getRecommendedQuestions'])
  })
  .prefix('/player-chatbots')

router
  .group(() => {
    router.post('/generate-response', [TeamChatbotsController, 'generateResponse'])
    router.delete('/discussions/:id', [TeamChatbotsController, 'deleteDiscussion'])
    router.get('/discussions/:discussionId/messages', [TeamChatbotsController, 'getMessages'])
  })
  .prefix('/team-chatbots')
  .middleware(middleware.auth())
  .middleware(middleware.permission('chatbot-team:view'))

router
  .group(() => {
    router.post('/analysis-variables', [MyCoachController, 'getAnalysisVariables'])
  })
  .prefix('/mycoach')

router
  .group(() => {
    router.post('/sync-firstbeat-athletes', [CronsController, 'syncFirstbeatAthletes'])
    router.post('/sync-vald-athletes', [CronsController, 'syncValdAthletes'])
    router.post('/sync-and-store-basketball', [CronsController, 'syncAndStoreBasketball'])
    router.post('/send-notifications', [CronsController, 'sendNotifications'])
    router.post('/sync-hambourg', [CronsController, 'syncHambourg'])
    router.post('/fetch-catapult-activities', [CronsController, 'fetchCatapultActivities'])
    router.post('/fetch-statsports-activities', [CronsController, 'fetchStatssportsActivities'])
    router.post('/fetch-match-providers', [CronsController, 'fetchMatchProviders'])
    router.post('/generate-sunderland-scores-for-all-athletes', [
      CronsController,
      'generateSunderlandScoresForAllAthletes',
    ])
  })
  .prefix('/crons')

router
  .group(() => {
    router
      .group(() => {
        router.post('/activity-details', [WebhooksController, 'processGarminActivityDetails'])
        router.post('/sleep', [WebhooksController, 'processGarminSleeps'])
      })
      .prefix('/garmin')

    router
      .group(() => {
        router.post('/workout-summary', [WebhooksController, 'processWahooWorkoutSummary'])
      })
      .prefix('/wahoo')

    router
      .group(() => {
        router.post('/', [WebhooksController, 'processWhoopWebhook'])
      })
      .prefix('/whoop')
  })
  .prefix('/webhooks')

router
  .group(() => {
    router.get('/', [ThresholdsController, 'getThresholds'])
  })
  .prefix('/thresholds')
  .middleware(middleware.auth())

router
  .group(() => {
    router.post('/invalidate-cache', [DemoPairsController, 'invalidateCache'])

    router.post('/backfill-embeddings', [DemoPairsController, 'backfillEmbeddings'])

    router.post('/time-variant-questions', [DemoPairsController, 'timeVariantQuestions'])
    router.post('/analyze-answer', [DemoPairsController, 'analyzeAnswer'])
    router.post('/save-from-demo', [DemoPairsController, 'saveFromDemo'])
    router.delete('/:id', [DemoPairsController, 'deletePair'])
  })
  .prefix('/demo-pairs')
  .middleware(middleware.auth())

router.post('/test-chatbot', [ChatbotsController, 'testChatbot'])

router
  .group(() => {
    router.post('/generate-activity', [SummariesController, 'generateActivitySummary'])
    router.post('/generate-nutrition', [SummariesController, 'generateNutritionSummary'])
    router.post('/generate-sleep', [SummariesController, 'generateSleepSummary'])
    router.post('/generate-health', [SummariesController, 'generateHealthSummary'])
    router.get('/activity/:date', [SummariesController, 'getActivitySummary'])
    router.get('/activity/:entityId/:date', [SummariesController, 'getActivitySummary'])
    router.get('/nutrition/:date', [SummariesController, 'getNutritionSummary'])
    router.get('/sleep/:date', [SummariesController, 'getSleepSummary'])
    router.get('/health/:date', [SummariesController, 'getHealthSummary'])
  })
  .prefix('/api/v2/summaries')

router
  .group(() => {
    queueDashUiRoutes().prefix('/queue')
  })
  .prefix('/admin')

router
  .group(() => {
    router
      .group(() => {
        router.get('/tdee', [AthletesController, 'getTDEE'])
        router.get('/bmr', [AthletesController, 'getBMR'])
        router.post('/calculate-training-load', [SportActivityController, 'calculateTrainingLoad'])
      })
      .middleware(middleware.backendV1Auth())
    router.post('/backfill', [SportActivityController, 'backfillActivities'])
  })
  .prefix('/api/v2')

router
  .group(() => {
    router.get('/:id', [SportActivityController, 'getFitData'])
  })
  .prefix('/sportactivity-fit-data')

router
  .group(() => {
    router.get('/games', [BasketballController, 'listTeamGames'])
    router.get('/games/:gameId', [BasketballController, 'getGameStats'])
    router.get('/matches', [BasketballController, 'listGamesOnly'])
    router.post('/matches/store', [BasketballController, 'storeGames'])
    router.put('/periods/:periodId/metrics', [BasketballController, 'updatePeriodMetrics'])
  })
  .prefix('/basketball')
  .middleware(middleware.auth())

router
  .group(() => {
    router
      .group(() => {
        router.get('/', [SleepController, 'getSleeps']).use(middleware.permission('sleep:view'))
        router
          .post('/', [SleepController, 'upsertSleep'])
          .use(middleware.permission('sleep:update'))
        router
          .delete('/:id', [SleepController, 'deleteSleep'])
          .use(middleware.permission('sleep:delete'))
      })
      .prefix('/sleeps')
    router
      .group(() => {
        router.get('/', [HealthController, 'getHealths']).use(middleware.permission('health:view'))
        router
          .post('/', [HealthController, 'upsertHealth'])
          .use(middleware.permission('health:update'))
        router
          .delete('/:id', [HealthController, 'deleteHealth'])
          .use(middleware.permission('health:update'))
      })
      .prefix('/healths')
    router
      .get('/event-types', [CalendarController, 'getEventTypes'])
      .use(middleware.permission('calendar:create'))
    router.get('/', [CalendarController, 'getEvents']).use(middleware.permission('calendar:view'))
    router
      .get('/:id', [CalendarController, 'getEvent'])
      .use(middleware.permission('calendar:view-detail'))
    router
      .post('/', [CalendarController, 'upsertEvent'])
      .use(middleware.permission('calendar:create'))
    router
      .put('/:id', [CalendarController, 'upsertEvent'])
      .use(middleware.permission('calendar:update'))
    router
      .delete('/:id', [CalendarController, 'deleteEvent'])
      .use(middleware.permission('calendar:delete'))
  })
  .prefix('/calendar')
  .middleware(middleware.auth())

router
  .group(() => {
    router.get('/', [SubjectiveScalesController, 'getScales'])
  })
  .prefix('/subjective-scales')
  .middleware(middleware.auth())

router
  .group(() => {
    router.get('/config/subjective-fields', [SportActivityController, 'getSubjectiveFieldsConfig'])
    router.get('/events/:eventId/activities', [SportActivityController, 'getEventActivities'])
    router.get('/used-activities', [SportActivityController, 'getUsedActivities'])
    router
      .put('/:id/subjective-fields', [SportActivityController, 'updateSubjectiveFields'])
      .use(middleware.permission('subjective-fields:update'))
    router.get('/activity-type/:activityTypeId/display-variables', [
      SportActivityController,
      'getActivityTypeDisplayVariables',
    ])
  })
  .prefix('/sport-activities')
  .middleware(middleware.auth())

router
  .group(() => {
    router.get('/locations', [PainsController, 'getLocations'])
    router
      .get('/', [PainsController, 'getAllPains'])
      .use(middleware.permission('pains-section:view'))
    router
      .post('/:sportActivityId', [PainsController, 'upsertActivityPain'])
      .use(middleware.permission('pains:update'))
    router
      .delete('/:painId', [PainsController, 'deletePain'])
      .use(middleware.permission('pains:delete'))
  })
  .prefix('/pains')
  .middleware(middleware.auth())

router.post('/la-route-pour-que-othman-puisse-regenerer-les-rapports', [
  TmpsController,
  'regenerateReport',
])
