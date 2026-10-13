import router from '@adonisjs/core/services/router';
import { middleware } from './kernel.js';
import AuthController from '#controllers/auth_controller';
import AthleteProfileController from '#controllers/mobile/athlete_profile_controller';
import SleepsController from '#controllers/mobile/sleeps_controller';
import HealthController from '#controllers/mobile/health_controller';
import ActivitiesController from '#controllers/mobile/activities_controller';
import PainsController from '#controllers/pains_controller';
import EvolutionController from '#controllers/mobile/evolution_controller';
import NutritionFavoritesController from '#controllers/mobile/nutrition/nutrition_favorites_controller';
import NutritionController from '#controllers/mobile/nutrition/nutrition_controller';
import NutritionRecipesController from '#controllers/mobile/nutrition/nutrition_recipes_controller';
import FoodAiController from '#controllers/mobile/nutrition/food_ai_controller';
import FoodIntakesController from '#controllers/mobile/nutrition/food_intakes_controller';
import GarminOauthController from '#controllers/mobile/garmin_oauth_controller';
import WahooOauthController from '#controllers/mobile/wahoo_oauth_controller';
import WhoopOauthController from '#controllers/mobile/whoop_oauth_controller';
import InjuryController from '#controllers/injury_controller';
import MobileCalendarController from '#controllers/mobile/calendar_controller';
import RegisterUtilitiesController from '#controllers/mobile/register_utilities_controller';
import MobileSummariesController from '#controllers/mobile/summaries_controller';
import MobilePlayerChatbotsController from '#controllers/mobile/player_chatbots_controller';
import SubjectiveScalesController from '#controllers/mobile/subjective_scales_controller';
router
    .group(() => {
    router
        .group(() => {
        router.post('/login', [AuthController, 'mobileLogin']);
        router.post('/refresh-token', [AuthController, 'mobileRefreshToken']);
        router.post('/athlete-exists', [AuthController, 'mobileAthleteExists']);
        router.post('/send-otp', [AuthController, 'mobileSendOtp']);
        router.post('/verify-otp', [AuthController, 'mobileVerifyOtp']);
        router.post('/forgot-password', [AuthController, 'mobileForgotPassword']);
        router.post('/logout', [AuthController, 'mobileLogout']).use(middleware.mobile());
    })
        .prefix('/auth');
    router
        .group(() => {
        router
            .group(() => {
            router.get('/', [AthleteProfileController, 'getProfile']);
            router.put('/', [AthleteProfileController, 'updateProfile']);
            router.put('/email', [AthleteProfileController, 'changeEmail']);
            router.put('/password', [AthleteProfileController, 'changePassword']);
        })
            .prefix('/profile');
        router
            .group(() => {
            router.get('/', [SleepsController, 'getSleep']);
            router.post('/', [SleepsController, 'addSleep']);
        })
            .prefix('/sleep');
        router
            .group(() => {
            router.get('/', [HealthController, 'getHealth']);
            router.post('/', [HealthController, 'addHealth']);
            router.get('/discomfort-locations', [HealthController, 'getDiscomfortLocations']);
            router.get('/utils', [HealthController, 'getHealthUtilities']);
        })
            .prefix('/health');
        router.get('/subjective-scales', [SubjectiveScalesController, 'getScales']);
        router
            .group(() => {
            router.get('/utilities', [ActivitiesController, 'getSportActivitiesUtilities']);
            router.post('/', [ActivitiesController, 'createActivity']);
            router.get('/', [ActivitiesController, 'getActivities']);
            router.get('/:id/fit-data', [ActivitiesController, 'getFitData']);
            router.put('/:id', [ActivitiesController, 'updateActivity']);
            router.delete('/:id', [ActivitiesController, 'deleteActivity']);
            router.get('/:id', [ActivitiesController, 'getActivity']);
        })
            .prefix('/activity');
        router
            .group(() => {
            router.get('/:sportActivityId', [PainsController, 'getAllPainsBySportActivityId']);
            router.post('/:sportActivityId', [PainsController, 'upsertActivityPain']);
            router.delete('/:painId', [PainsController, 'deletePain']);
        })
            .prefix('/activity-pain');
        router
            .group(() => {
            router.get('/sleep', [EvolutionController, 'getSleepEvolution']);
            router.get('/health', [EvolutionController, 'getHealthEvolution']);
            router.get('/activity', [EvolutionController, 'getActivityEvolution']);
            router.get('/nutrition', [EvolutionController, 'getNutritionEvolution']);
        })
            .prefix('/evolution');
        router
            .group(() => {
            router
                .group(() => {
                router.post('/recognize', [FoodAiController, 'recognizeFoodItems']);
                router.post('/analyze', [FoodAiController, 'analyzeNutritionFromItems']);
            })
                .prefix('/ai');
            router
                .group(() => {
                router.get('/', [FoodIntakesController, 'list']);
                router.post('/', [FoodIntakesController, 'create']);
                router.delete('/:id', [FoodIntakesController, 'delete']);
            })
                .prefix('/food-intake');
            router
                .group(() => {
                router.get('/', [NutritionFavoritesController, 'getFavorites']);
                router.delete('/:id', [NutritionFavoritesController, 'deleteFavorite']);
                router.post('/', [NutritionFavoritesController, 'addFavorite']);
            })
                .prefix('/favorites');
            router
                .group(() => {
                router.post('/', [NutritionRecipesController, 'addRecipe']);
                router.put('/:id', [NutritionRecipesController, 'updateRecipe']);
                router.get('/', [NutritionRecipesController, 'getRecipes']);
                router.delete('/:id', [NutritionRecipesController, 'deleteRecipe']);
            })
                .prefix('/recipes');
            router.get('/search-aliments', [NutritionController, 'searchAliments']);
            router.get('/resumes', [NutritionController, 'getNutritionSummary']);
            router.get('/recents', [NutritionController, 'getRecents']);
            router.post('/aliments', [NutritionController, 'addAliment']);
            router.get('/macro-intervals', [NutritionController, 'getMacroIntervals']);
            router.get('/tdee', [NutritionController, 'getTdee']);
            router.get('/skipped-meals', [NutritionController, 'getSkippedMeals']);
            router.patch('/skipped-meals', [NutritionController, 'updateSkippedMeals']);
            router.get('/openfoodfacts/:barcode', [
                NutritionController,
                'getOpenFoodFactsByBarcode',
            ]);
            router.post('/', [NutritionController, 'addNutrition']);
            router.get('/', [NutritionController, 'getNutrition']);
            router.put('/:id', [NutritionController, 'updateNutrition']);
            router.delete('/:id', [NutritionController, 'deleteNutrition']);
        })
            .prefix('/nutrition');
        router
            .group(() => {
            router.get('/types', [InjuryController, 'getInjuryTypes']);
        })
            .prefix('/injury');
        router
            .group(() => {
            router.get('/authorize', [GarminOauthController, 'authorize']);
            router.get('/token', [GarminOauthController, 'token']);
            router.delete('/disconnect', [GarminOauthController, 'disconnect']);
        })
            .prefix('/garmin');
        router
            .group(() => {
            router.get('/authorize', [WahooOauthController, 'authorize']);
            router.get('/token', [WahooOauthController, 'token']);
            router.delete('/disconnect', [WahooOauthController, 'disconnect']);
        })
            .prefix('/wahoo');
        router
            .group(() => {
            router.get('/authorize', [WhoopOauthController, 'authorize']);
            router.get('/token', [WhoopOauthController, 'token']);
            router.delete('/disconnect', [WhoopOauthController, 'disconnect']);
        })
            .prefix('/whoop');
        router
            .group(() => {
            router.get('/check', [MobileCalendarController, 'calendarCheck']);
            router.get('/event-types', [MobileCalendarController, 'getEventTypes']);
            router.get('/events', [MobileCalendarController, 'getEvents']);
            router.get('/events/:id', [MobileCalendarController, 'getEvent']);
        })
            .prefix('/calendar');
        router
            .group(() => {
            router.get('/utils', [RegisterUtilitiesController, 'getRegisterUtilities']);
        })
            .prefix('/register');
        router
            .group(() => {
            router.post('/activity', [MobileSummariesController, 'generateActivitySummary']);
            router.post('/nutrition', [MobileSummariesController, 'generateNutritionSummary']);
            router.post('/sleep', [MobileSummariesController, 'generateSleepSummary']);
            router.post('/health', [MobileSummariesController, 'generateHealthSummary']);
            router.get('/activity/:date', [MobileSummariesController, 'getActivitySummary']);
            router.get('/activity/:date/:entity_id', [
                MobileSummariesController,
                'getActivitySummary',
            ]);
            router.get('/nutrition/:date/meta', [
                MobileSummariesController,
                'getNutritionSummaryMeta',
            ]);
            router.get('/nutrition/:date', [MobileSummariesController, 'getNutritionSummary']);
            router.get('/sleep/:date', [MobileSummariesController, 'getSleepSummary']);
            router.get('/health/:date', [MobileSummariesController, 'getHealthSummary']);
        })
            .prefix('/summaries');
        router
            .group(() => {
            router.post('/generate-response', [MobilePlayerChatbotsController, 'generateResponse']);
            router.get('/discussions', [MobilePlayerChatbotsController, 'getDiscussions']);
            router.get('/discussions/:discussionId/messages', [
                MobilePlayerChatbotsController,
                'getMessages',
            ]);
            router.get('/recommended-questions', [
                MobilePlayerChatbotsController,
                'getRecommendedQuestions',
            ]);
        })
            .prefix('/chatbot');
    })
        .middleware(middleware.mobile());
})
    .prefix('/mobile');
//# sourceMappingURL=mobile_routes.js.map