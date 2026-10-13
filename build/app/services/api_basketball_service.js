import axios from 'axios';
import { DateTime } from 'luxon';
import env from '#start/env';
import AthleteService from '#services/athlete_service';
import SportActivity from '#models_pg/sport_activity';
import Period from '#models_pg/period';
import PeriodMetric from '#models_pg/period_metric';
import { PeriodMetricService } from '#services/period_metric_service';
import { SportActivityService } from '#services/sport_activity_service';
import { BASKETBALL_METRICS, BASKETBALL_SYNC_DAYS, JL_BOURG_TEAM_ID, DEFAULT_LNB_SEASON, DEFAULT_EUROCUP_SEASON, DEFAULT_LEADERS_CUP_SEASON, LNB_LEAGUE_ID, EUROCUP_LEAGUE_ID, LEADERS_CUP_LEAGUE_ID, DEFAULT_BASKETBALL_CLUB_ID, TEAM_STAT_COLUMNS, TEAM_STATS_SYNC, PLAYER_STAT_COLUMNS, PLAYER_STATS_SYNC, FINISHED_GAME_REGEX, } from '#constants/basketball.constants';
import logger from '@adonisjs/core/services/logger';
import SlackService from '#services/slack_service';
import { BASKETBALL_ACTIVITY_TYPE_ID, mapStatisticsEntry, extractRoster, } from '../utils/training_loads/basketball/basketball.js';
import { BasketballTrainingLoad } from '../utils/training_loads/basketball/training_load.js';
import { toCamel } from '../utils/basketball.js';
import { parseMinutesToSeconds } from '../utils/time.js';
import AthleteProvider from '#models_pg/athlete_provider';
import { ATHLETE_PROVIDER_TYPES } from '#constants/athlete_provider.constants';
import BasketballGame from '#models_pg/basketball_game';
import BasketballGameStat from '#models_pg/basketball_game_stat';
import BasketballGamePlayerStat from '#models_pg/basketball_game_player_stat';
import db from '@adonisjs/lucid/services/db';
import Event from '#models_pg/event';
import EventType from '#models_pg/event_type';
import { EVENT_CATEGORY } from '#constants/event.constants';
import Day from '#models_pg/day';
import { APP_LANGUAGES } from '#utils/localize';
const ALL_LEAGUES_CONFIG = [
    { league: LNB_LEAGUE_ID, season: DEFAULT_LNB_SEASON },
    { league: EUROCUP_LEAGUE_ID, season: DEFAULT_EUROCUP_SEASON },
    { league: LEADERS_CUP_LEAGUE_ID, season: '2026' },
];
export default class ApiBasketballService {
    baseUrl;
    headers;
    timeout = 10_000;
    constructor(config = {
        baseUrl: env.get('API_BASKETBALL_URL'),
        apiKey: env.get('API_BASKETBALL_KEY'),
    }) {
        const parsedUrl = new URL(config.baseUrl);
        this.baseUrl = config.baseUrl;
        this.headers = {
            'x-rapidapi-key': config.apiKey,
            'x-rapidapi-host': parsedUrl.hostname,
        };
    }
    async request(endpoint, params, timeout = this.timeout) {
        const response = await axios.get(`${this.baseUrl}${endpoint}`, {
            params,
            headers: this.headers,
            timeout,
        });
        return response.data;
    }
    async fetchGames(params) {
        return this.request('/games', params);
    }
    async fetchGameStatistics(gameId) {
        return this.request('/games/statistics/players', { id: gameId });
    }
    async fetchGamePlayers(gameId) {
        return this.request('/games/players', { id: gameId });
    }
    async fetchGameTeamStatistics(params) {
        const data = await this.request('/games/statistics/teams', params, TEAM_STATS_SYNC['timeoutMs']);
        return data.response ?? [];
    }
}
export class BasketballService {
    athleteService;
    periodMetricService;
    sportActivityService;
    apiBasketballService;
    slackService;
    constructor() {
        this.athleteService = new AthleteService();
        this.periodMetricService = new PeriodMetricService();
        this.sportActivityService = new SportActivityService();
        this.apiBasketballService = new ApiBasketballService();
        this.slackService = new SlackService();
    }
    async getBasketballMetricsMap() {
        const metrics = await PeriodMetric.query().whereIn('name', [...BASKETBALL_METRICS]);
        return new Map(metrics.map((metric) => [metric.name, metric]));
    }
    async computeBasketballExternalLoad(activityId, options) {
        return this.sportActivityService.computeBasketballExternalLoad(activityId, options);
    }
    toGamesQueryParams({ teamId, season, league, date, id, }) {
        return {
            team: teamId,
            ...(season !== undefined && { season }),
            ...(league !== undefined && { league }),
            ...(date !== undefined && { date }),
            ...(id !== undefined && { id }),
        };
    }
    async fetchRecentGames(days, teamId, league, season) {
        const startDate = DateTime.now().minus({ days });
        const processedGameIds = new Set();
        const allGames = [];
        for (let i = 0; i < days; i++) {
            const dateString = startDate.plus({ days: i }).toFormat('yyyy-MM-dd');
            const games = await this.apiBasketballService
                .fetchGames(this.toGamesQueryParams({
                date: dateString,
                league,
                season,
                teamId,
            }))
                .then((result) => result.response ?? [])
                .catch((error) => {
                logger.warn({
                    err: error,
                    date: dateString,
                    league,
                    season,
                    teamId,
                }, 'Error fetching recent games');
                return [];
            });
            for (const game of games) {
                if (!processedGameIds.has(game.id)) {
                    processedGameIds.add(game.id);
                    allGames.push(game);
                }
            }
            await new Promise((resolve) => setTimeout(resolve, 200));
        }
        return allGames;
    }
    mergeAndSortGames(games) {
        const byId = new Map();
        for (const game of games)
            byId.set(game.id, game);
        return Array.from(byId.values()).sort((a, b) => a.date.localeCompare(b.date));
    }
    async fetchRecentGamesForLeagues(days, teamId, leagues) {
        const results = await Promise.all(leagues.map(({ league, season }) => this.fetchRecentGames(days, teamId, league, season)));
        return this.mergeAndSortGames(results.flat());
    }
    async fetchGamesDataForLastDays(days, params) {
        const season = params.season ?? DEFAULT_LNB_SEASON;
        if (params.league != null) {
            const games = await this.fetchRecentGames(days, params.teamId, params.league, season);
            return games;
        }
        if (params.allLeagues) {
            const leagues = ALL_LEAGUES_CONFIG.map(({ league, season }) => ({
                league,
                season: season,
            }));
            const games = await this.fetchRecentGamesForLeagues(days, params.teamId, leagues);
            return games;
        }
        const games = await this.fetchRecentGames(days, params.teamId, LNB_LEAGUE_ID, season);
        return games;
    }
    async fetchGamesData(params) {
        const teamId = params.teamId ?? params.team;
        const allLeagues = params.allLeagues === true;
        if (teamId == null) {
            return this.apiBasketballService.fetchGames({
                team: params.team,
                season: params.season,
                league: params.league,
            });
        }
        if (params.league != null || !allLeagues) {
            return this.apiBasketballService.fetchGames(this.toGamesQueryParams({
                teamId,
                season: params.season ?? DEFAULT_LNB_SEASON,
                league: params.league,
                date: params.date,
            }));
        }
        const games = await this.fetchAllLeaguesGames({
            teamId,
            seasonLnb: params.seasonLnb ?? params.season ?? DEFAULT_LNB_SEASON,
            seasonEurocup: params.seasonEurocup ?? DEFAULT_EUROCUP_SEASON,
            seasonLeadersCup: params.seasonLeadersCup ?? DEFAULT_LEADERS_CUP_SEASON,
        });
        return { response: games, results: games.length };
    }
    async fetchAllLeaguesGames(params) {
        const leagueResponses = await Promise.all(ALL_LEAGUES_CONFIG.map(({ league, season }) => this.apiBasketballService.fetchGames(this.toGamesQueryParams({
            teamId: params.teamId,
            season: season,
            league,
        }))));
        return this.mergeAndSortGames(leagueResponses.flatMap((r) => r.response ?? []));
    }
    async processGamesWithStats(games, teamId) {
        const statsByGame = [];
        for (let i = 0; i < games.length; i++) {
            const { statistics, roster } = await this.fetchGameStatsAndRoster(games[i].id, teamId);
            statsByGame.push({ gameId: games[i].id, statistics, roster });
        }
        return statsByGame;
    }
    async fetchGameStatsAndRoster(gameId, teamId) {
        const [statsResponse, playersResponse] = await Promise.all([
            this.apiBasketballService.fetchGameStatistics(String(gameId)),
            this.apiBasketballService.fetchGamePlayers(String(gameId)),
        ]);
        const teamStats = statsResponse.response.filter((entry) => entry.team.id === teamId);
        const statistics = teamStats.map(mapStatisticsEntry);
        const roster = extractRoster(playersResponse, teamId, teamStats);
        return { statistics, roster };
    }
    async getAthleteSportActivities(athleteId) {
        return SportActivity.query()
            .whereHas('day', (query) => {
            query.where('athleteId', athleteId);
        })
            .andWhere('gameActivity', true)
            .preload('periods', (query) => {
            query.preload('metricValues', (query) => {
                query.preload('metric');
            });
        })
            .orderBy('createdAt', 'desc');
    }
    calculateBasketballMetrics(stats, playerPositionName, game) {
        const raw = BasketballTrainingLoad.extractRawStats(stats);
        const calculated = BasketballTrainingLoad.calculatePositionMetrics(playerPositionName, raw);
        const combined = { ...raw, ...calculated };
        const matchResult = game.matchResult;
        return {
            ...combined,
            basketball_match_result: matchResult,
        };
    }
    async computeTrainingLoadForActivity(activityId, athleteId) {
        const historicalActivities = await this.getAthleteSportActivities(athleteId);
        await this.sportActivityService.computeBasketballExternalLoad(activityId, {
            useHistorical: historicalActivities.length > 0,
            historicalActivities: historicalActivities.filter((a) => a.id !== activityId),
            updateTrainingLoad: true,
        });
    }
    async findExistingPeriodForGame(gameId, athleteId) {
        const existingPeriodForGame = await Period.query()
            .where('providerId', String(gameId))
            .whereHas('sportActivity', (query) => {
            query.where('dataSource', 'api_basket').whereHas('day', (dayQuery) => {
                dayQuery.where('athleteId', athleteId);
            });
        })
            .preload('sportActivity')
            .first();
        return existingPeriodForGame?.sportActivity ?? null;
    }
    async findExistingActivityForAthlete(athleteId, day, timeOfActivity) {
        if (!day.dateOfDay) {
            throw new Error(`Day (id: ${day.id}) has a null dateOfDay. This should never happen and indicates a data integrity issue.`);
        }
        const event = await Event.query()
            .whereHas('athletes', (query) => {
            query.where('id', athleteId);
        })
            .whereHas('eventType', (query) => {
            query.where('eventCategory', EVENT_CATEGORY.MATCHES);
        })
            .first();
        if (event) {
            return null;
        }
        const manualActivity = await SportActivity.query()
            .whereHas('day', (query) => {
            query
                .where('athleteId', athleteId)
                .where('dateOfDay', day.dateOfDay.toFormat('yyyy-MM-dd'));
        })
            .whereHas('event', (query) => {
            query.whereHas('eventType', (eventTypeQuery) => {
                eventTypeQuery.where('eventCategory', EVENT_CATEGORY.MATCHES);
            });
        })
            .where('dataSource', 'manual')
            .where('activityTypeId', String(BASKETBALL_ACTIVITY_TYPE_ID))
            .first();
        if (manualActivity) {
            return manualActivity;
        }
        return SportActivity.query()
            .whereHas('day', (query) => {
            query
                .where('athleteId', athleteId)
                .where('dateOfDay', day.dateOfDay.toFormat('yyyy-MM-dd'));
        })
            .where('timeOfActivity', timeOfActivity)
            .where('dataSource', 'api_basket')
            .where('activityTypeId', String(BASKETBALL_ACTIVITY_TYPE_ID))
            .first();
    }
    async mergePeriodForExistingActivity(existingActivity, params) {
        const trx = await db.transaction();
        try {
            if (existingActivity.dataSource === 'manual') {
                existingActivity.useTransaction(trx);
                existingActivity.merge({
                    dataSource: 'api_basket',
                    ...(params.secondsOnCourt !== null && {
                        durationSeconds: params.secondsOnCourt,
                    }),
                });
                await existingActivity.save();
            }
            const period = await this.upsertActivityPeriod({
                sportActivity: existingActivity,
                game: params.game,
                activityName: params.activityName,
                secondsOnCourt: params.secondsOnCourt,
                trx,
            });
            const resolvedPlayerPositionName = await this.resolvePlayerPositionName(params.athleteId, params.playerPositionName);
            const metrics = this.calculateBasketballMetrics(params.stats, resolvedPlayerPositionName, params.game);
            await this.periodMetricService.storePeriodMetrics(period, metrics, {
                metricNames: [...BASKETBALL_METRICS],
                transaction: trx,
            });
            await trx.commit();
            await this.computeTrainingLoadForActivity(existingActivity.id, params.athleteId);
            return existingActivity;
        }
        catch (error) {
            await trx.rollback();
            throw error;
        }
    }
    async createNewSportActivityWithPeriod(day, params) {
        const trx = await db.transaction();
        try {
            const sportActivity = await SportActivity.create({
                dayId: day.id,
                activityTypeId: String(BASKETBALL_ACTIVITY_TYPE_ID),
                activityName: params.activityName,
                dataSource: 'api_basket',
                timeOfActivity: params.timeOfActivity,
                durationSeconds: params.durationSeconds,
                gameActivity: true,
            }, { client: trx });
            const period = await this.upsertActivityPeriod({
                sportActivity,
                game: params.game,
                activityName: params.activityName,
                secondsOnCourt: params.secondsOnCourt,
                trx,
            });
            const resolvedPlayerPositionName = await this.resolvePlayerPositionName(params.athleteId, params.playerPositionName);
            const metrics = this.calculateBasketballMetrics(params.stats, resolvedPlayerPositionName, params.game);
            await this.periodMetricService.storePeriodMetrics(period, metrics, {
                metricNames: [...BASKETBALL_METRICS],
                transaction: trx,
            });
            await trx.commit();
            await this.computeTrainingLoadForActivity(sportActivity.id, params.athleteId);
            return sportActivity;
        }
        catch (error) {
            await trx.rollback();
            throw error;
        }
    }
    async persistSportActivity(params) {
        const { athleteId, game, stats, playerPositionName } = params;
        if (!game?.id)
            throw new Error('Game ID is required to persist sport activity');
        const ctx = { athleteId, gameId: game.id };
        try {
            const startTime = this.getGameStartTime(game);
            const timeOfActivity = startTime.toFormat('HH:mm:ss');
            const day = await this.athleteService.getOrCreateDay(athleteId, startTime);
            if (!day.dateOfDay) {
                throw new Error(`Failed to get or create athlete day with valid dateOfDay for athlete ${athleteId} at ${startTime.toISO()}`);
            }
            const secondsOnCourt = parseMinutesToSeconds(stats.minutes);
            const durationSeconds = secondsOnCourt;
            const activityName = this.getGameTitle(game);
            const existingPeriodActivity = await this.findExistingPeriodForGame(game.id, athleteId);
            if (existingPeriodActivity)
                return this.mergePeriodForExistingActivity(existingPeriodActivity, {
                    game,
                    activityName,
                    secondsOnCourt,
                    athleteId,
                    playerPositionName,
                    stats,
                });
            const existingActivity = await this.findExistingActivityForAthlete(athleteId, day, timeOfActivity);
            if (existingActivity) {
                return this.mergePeriodForExistingActivity(existingActivity, {
                    game,
                    activityName,
                    secondsOnCourt,
                    athleteId,
                    playerPositionName,
                    stats,
                });
            }
            try {
                return await this.createNewSportActivityWithPeriod(day, {
                    game,
                    activityName,
                    timeOfActivity,
                    durationSeconds,
                    secondsOnCourt,
                    athleteId,
                    playerPositionName,
                    stats,
                });
            }
            catch (createError) {
                const activityToMerge = await this.findExistingActivityForAthlete(athleteId, day, timeOfActivity);
                if (!activityToMerge)
                    throw createError;
                return this.mergePeriodForExistingActivity(activityToMerge, {
                    game,
                    activityName,
                    secondsOnCourt,
                    athleteId,
                    playerPositionName,
                    stats,
                });
            }
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            logger.error({ ...ctx, error: msg }, 'persistSportActivity failed');
            throw error;
        }
    }
    async upsertActivityPeriod({ sportActivity, game, activityName, secondsOnCourt, trx, }) {
        const gameStartTime = this.getGameStartTime(game);
        const gameEndTime = secondsOnCourt
            ? gameStartTime.plus({ seconds: secondsOnCourt })
            : gameStartTime.plus({ minutes: 48 });
        const existingPeriod = await Period.query({ client: trx })
            .where('sportActivityId', sportActivity.id)
            .where('providerId', String(game.id))
            .first();
        if (existingPeriod) {
            await existingPeriod
                .merge({ startTime: gameStartTime, endTime: gameEndTime, name: activityName })
                .save();
            return existingPeriod;
        }
        return Period.create({
            sportActivityId: sportActivity.id,
            providerId: String(game.id),
            name: activityName,
            startTime: gameStartTime,
            endTime: gameEndTime,
        }, { client: trx });
    }
    async resolvePlayerPositionName(athleteId, providedName) {
        if (providedName)
            return providedName;
        const positionName = await this.athleteService.getAthletePositionName(athleteId, APP_LANGUAGES.EN);
        if (!positionName)
            throw new Error('Athlete or player position not found');
        return positionName;
    }
    async buildAthleteMap(clubId) {
        const athleteProviders = await AthleteProvider.query()
            .where('provider', ATHLETE_PROVIDER_TYPES.API_BASKETBALL)
            .whereHas('athlete', (query) => {
            query.where('clubId', clubId);
        })
            .preload('athlete');
        return athleteProviders.reduce((map, provider) => {
            if (provider.providerAthleteId === null)
                return map;
            map.set(provider.providerAthleteId, {
                athleteId: provider.athleteId,
                athleteName: provider.athlete.name,
            });
            return map;
        }, new Map());
    }
    async syncBasketballAthletes(clubId = String(DEFAULT_BASKETBALL_CLUB_ID)) {
        const athleteMap = await this.buildAthleteMap(clubId);
        const periods = await Period.query()
            .whereNotNull('providerId')
            .whereHas('sportActivity', (q) => q.where('dataSource', 'api_basket'))
            .select('providerId');
        const processedGameIds = new Set();
        for (const p of periods) {
            if (p.providerId)
                processedGameIds.add(p.providerId);
        }
        const games = await this.fetchRecentGamesForLeagues(BASKETBALL_SYNC_DAYS, JL_BOURG_TEAM_ID, ALL_LEAGUES_CONFIG);
        const gamesToProcess = games.filter((game) => {
            const statusShort = game.status.short ?? 'NS';
            const isFinished = FINISHED_GAME_REGEX.test(statusShort);
            const hasScores = game.scores.home.total !== null && game.scores.away.total !== null;
            return (isFinished || hasScores) && !processedGameIds.has(String(game.id));
        });
        await this.processGamesForSync(gamesToProcess, athleteMap, processedGameIds);
    }
    async processGamesForSync(games, athleteMap, processedGameIds) {
        const postedGameIds = new Set();
        for (const game of games) {
            try {
                await this.handleSlackNotification(game, processedGameIds, postedGameIds);
                const [allStats, playerPositionsMap] = await this.fetchGameData(game);
                for (const stats of allStats) {
                    const athlete = athleteMap.get(String(stats.player.id));
                    if (!athlete)
                        continue;
                    const { athleteId, athleteName } = athlete;
                    const playerPositionName = playerPositionsMap.get(stats.player.id) ?? 'Center (C)';
                    await this.processPlayerStats({
                        stats,
                        game,
                        athleteId,
                        athleteName,
                        playerPositionName,
                    });
                }
            }
            catch (error) {
                logger.error({ error, gameId: game.id }, 'Failed to process basketball game in sync');
            }
        }
    }
    async handleSlackNotification(game, processedGameIds, postedGameIds) {
        const hasExistingActivity = processedGameIds.has(String(game.id));
        const alreadyPosted = postedGameIds.has(game.id);
        if (!hasExistingActivity && !alreadyPosted) {
            try {
                await this.slackService.postBasketballMatchResult(game);
                postedGameIds.add(game.id);
            }
            catch (error) {
                logger.error({ error, gameId: game.id }, 'Failed to post basketball match result to Slack');
            }
        }
    }
    async fetchGameData(game) {
        const [statsResponse, playersResponse] = await Promise.all([
            this.apiBasketballService.fetchGameStatistics(String(game.id)),
            this.apiBasketballService.fetchGamePlayers(String(game.id)).catch(() => ({ response: [] })),
        ]);
        const allStats = (statsResponse?.response ?? []).filter((stat) => stat.team.id === JL_BOURG_TEAM_ID);
        const playerPositionsMap = new Map();
        for (const teamEntry of playersResponse?.response ?? []) {
            for (const player of teamEntry.players) {
                if (player.id)
                    playerPositionsMap.set(player.id, player.pos ?? null);
            }
        }
        return [allStats, playerPositionsMap];
    }
    async processPlayerStats({ stats, game, athleteId, athleteName, playerPositionName, }) {
        const teamApiId = stats.team.id;
        try {
            const { default: ProcessBasketballJob } = await import('#jobs/process_basketball_job');
            await ProcessBasketballJob.dispatch({
                athleteId,
                game,
                stats,
                teamApiId,
                playerPositionName,
            });
            const minutes = typeof stats.minutes === 'string' ? parseFloat(stats.minutes) : (stats.minutes ?? 0);
            return {
                athleteName,
                trainingLoad: null,
                minutes,
                points: stats.points ?? 0,
                assists: stats.assists ?? 0,
                rebounds: stats.rebounds?.total ?? 0,
            };
        }
        catch (error) {
            logger.error({
                error: error instanceof Error ? error.message : String(error),
                athleteId,
                gameId: game.id,
            }, 'Failed to dispatch basketball job');
            return null;
        }
    }
    async runStoreBasketballMatchsAllLeagues(clubId = String(DEFAULT_BASKETBALL_CLUB_ID)) {
        try {
            const games = (await this.fetchGamesData({ team: JL_BOURG_TEAM_ID, allLeagues: true })).response ?? [];
            if (games.length === 0)
                return { success: true, stored: 0, total: 0 };
            const stored = await this.storeGamesInDatabase(games, clubId);
            return { success: true, stored: stored.length, total: games.length };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            logger.error({ error, clubId }, 'runStoreBasketballMatchsAllLeagues failed');
            return { success: false, stored: 0, total: 0, error: msg };
        }
    }
    getGameStartTime(game) {
        return DateTime.fromSeconds(game.timestamp);
    }
    getGameTitle(game) {
        return `${game.teams.home.name} vs ${game.teams.away.name}`;
    }
    isGameFinished(statusShort) {
        return statusShort != null && FINISHED_GAME_REGEX.test(statusShort);
    }
    buildBasketballGameData(game, gameStartTime, gameEndTime, title) {
        return {
            startTime: gameStartTime,
            endTime: gameEndTime,
            timestamp: game.timestamp,
            title,
            statusShort: game.status.short,
            leagueId: game.league.id,
            leagueName: game.league.name,
            leagueSeason: game.league.season,
            leagueLogo: game.league.logo,
            homeTeamId: game.teams.home.id,
            homeTeamName: game.teams.home.name,
            awayTeamId: game.teams.away.id,
            awayTeamName: game.teams.away.name,
            homeScoreQ1: game.scores.home.quarter_1,
            homeScoreQ2: game.scores.home.quarter_2,
            homeScoreQ3: game.scores.home.quarter_3,
            homeScoreQ4: game.scores.home.quarter_4,
            homeScoreOt: game.scores.home.over_time,
            homeScoreTotal: game.scores.home.total,
            awayScoreQ1: game.scores.away.quarter_1,
            awayScoreQ2: game.scores.away.quarter_2,
            awayScoreQ3: game.scores.away.quarter_3,
            awayScoreQ4: game.scores.away.quarter_4,
            awayScoreOt: game.scores.away.over_time,
            awayScoreTotal: game.scores.away.total,
        };
    }
    async storeGamesInDatabase(games, clubId) {
        if (games.length === 0) {
            return [];
        }
        const storedGames = [];
        let newGamesCount = false;
        const apiGameIds = games.map((game) => game.id);
        const existingGames = await BasketballGame.query()
            .where('clubId', clubId)
            .whereIn('apiGameId', apiGameIds);
        const existingByApiGameId = new Map();
        for (const existingGame of existingGames) {
            existingByApiGameId.set(existingGame.apiGameId, existingGame);
        }
        for (const game of games) {
            try {
                const gameStartTime = this.getGameStartTime(game);
                const gameEndTime = gameStartTime.plus({ hours: 2 });
                const title = this.getGameTitle(game);
                const existingGame = existingByApiGameId.get(game.id);
                if (existingGame) {
                    existingGame.merge(this.buildBasketballGameData(game, gameStartTime, gameEndTime, title));
                    await existingGame.save();
                    storedGames.push(existingGame);
                }
                else {
                    const basketballGame = await BasketballGame.create({
                        clubId,
                        apiGameId: game.id,
                        ...this.buildBasketballGameData(game, gameStartTime, gameEndTime, title),
                    });
                    newGamesCount = true;
                    storedGames.push(basketballGame);
                }
            }
            catch (error) {
                logger.error({
                    error: error instanceof Error ? error.message : String(error),
                    gameId: game.id,
                    clubId,
                }, 'Failed to store basketball game in database');
            }
        }
        if (newGamesCount === false) {
            logger.info('All basketball games were skipped');
        }
        const finishedGames = storedGames.filter((game) => this.isGameFinished(game.statusShort));
        if (finishedGames.length > 0) {
            await this.syncBasketballGamesWithEvents(finishedGames, clubId);
        }
        const syncLimitDate = DateTime.now().minus({ days: BASKETBALL_SYNC_DAYS }).toJSDate();
        const recentClubGames = await BasketballGame.query()
            .where('clubId', clubId)
            .where('startTime', '>=', syncLimitDate)
            .orderBy('apiGameId');
        await this.syncTeamStats(recentClubGames).catch((error) => {
            logger.warn({ error, clubId }, 'Failed to sync team stats for basketball games.');
        });
        await this.syncPlayerStats(recentClubGames).catch((error) => {
            logger.warn({ error, clubId }, 'Failed to sync player stats for basketball games.');
        });
        return storedGames;
    }
    async syncTeamStats(games) {
        if (games.length === 0)
            return;
        const gameByApiId = new Map(games.map((g) => [g.apiGameId, g]));
        const apiGameIds = [...gameByApiId.keys()];
        const { batchSize, delayMs } = TEAM_STATS_SYNC;
        for (let i = 0; i < apiGameIds.length; i += batchSize) {
            const idsParam = apiGameIds.slice(i, i + batchSize).join('-');
            const entries = await this.apiBasketballService
                .fetchGameTeamStatistics({ ids: idsParam })
                .catch((err) => {
                logger.warn({ ids: idsParam, error: err }, 'Failed to fetch team statistics');
                return [];
            });
            const statsByGameId = new Map();
            for (const entry of entries) {
                const game = gameByApiId.get(entry.game.id);
                if (!game)
                    continue;
                let slot = statsByGameId.get(game.id);
                if (!slot)
                    statsByGameId.set(game.id, (slot = { home: null, away: null }));
                if (entry.team.id === game.homeTeamId)
                    slot.home = entry;
                else if (entry.team.id === game.awayTeamId)
                    slot.away = entry;
            }
            for (const [gameId, { home, away }] of statsByGameId) {
                await BasketballGameStat.updateOrCreate({ basketballGameId: gameId }, { basketballGameId: gameId, ...this.buildTeamStatPayload(home, away) });
            }
            if (i + batchSize < apiGameIds.length) {
                await new Promise((r) => setTimeout(r, delayMs));
            }
        }
    }
    async syncPlayerStats(games) {
        if (games.length === 0)
            return;
        const gameByApiId = new Map(games.map((g) => [g.apiGameId, g]));
        const { delayMs } = PLAYER_STATS_SYNC;
        for (const [apiGameId, game] of gameByApiId) {
            const response = await this.apiBasketballService
                .fetchGameStatistics(String(apiGameId))
                .catch(() => ({ response: [] }));
            for (const entry of response.response ?? []) {
                const payload = this.buildPlayerStatPayload(entry, game.id);
                await BasketballGamePlayerStat.updateOrCreate({ basketballGameId: game.id, apiPlayerId: entry.player.id }, { basketballGameId: game.id, ...payload });
            }
            await new Promise((r) => setTimeout(r, delayMs));
        }
    }
    buildPlayerStatPayload(entry, basketballGameId) {
        const payload = {
            basketballGameId,
            apiPlayerId: entry.player.id,
            apiTeamId: entry.team.id,
            playerName: entry.player.name ?? null,
            type: entry.type ?? null,
            minutes: entry.minutes ?? null,
        };
        for (const col of PLAYER_STAT_COLUMNS) {
            if ('props' in col) {
                const obj = entry[col.apiKey];
                for (const prop of col.props)
                    payload[toCamel(col.apiKey, prop)] = obj?.[prop] ?? null;
            }
            else {
                payload[toCamel(col.apiKey)] =
                    entry[col.apiKey] ?? null;
            }
        }
        return payload;
    }
    buildTeamStatPayload(home, away) {
        const payload = {};
        const key = (side, apiKey, prop) => side +
            apiKey
                .split('_')
                .map((s) => s[0].toUpperCase() + s.slice(1))
                .join('') +
            (prop ? prop[0].toUpperCase() + prop.slice(1) : '');
        const teams = [
            { side: 'home', entry: home },
            { side: 'away', entry: away },
        ];
        for (const { side, entry } of teams) {
            for (const col of TEAM_STAT_COLUMNS) {
                const statData = entry?.[col.apiKey];
                if ('props' in col) {
                    const obj = statData;
                    for (const prop of col.props) {
                        payload[key(side, col.apiKey, prop)] = obj?.[prop] ?? null;
                    }
                }
                else {
                    payload[key(side, col.apiKey)] = statData ?? null;
                }
            }
        }
        return payload;
    }
    async getBasketballEventType() {
        return EventType.query().where('eventCategory', EVENT_CATEGORY.MATCHES).first();
    }
    async linkActivitiesToEvent(eventId) {
        const event = await Event.query().where('id', eventId).preload('basketballGames').first();
        if (!event || event.basketballGames.length === 0)
            return;
        const clubId = event.clubId;
        const apiGameIds = event.basketballGames.map((g) => g.apiGameId);
        const periods = await Period.query()
            .whereIn('providerId', apiGameIds.map(String))
            .preload('sportActivity');
        const sportActivityIds = periods
            .map((p) => p.sportActivity?.id)
            .filter((id) => id != null);
        if (sportActivityIds.length === 0)
            return;
        await SportActivity.query()
            .whereIn('id', sportActivityIds)
            .whereHas('day', (q) => {
            q.whereHas('athlete', (aq) => aq.where('clubId', clubId));
        })
            .whereNull('eventId')
            .update({ eventId });
    }
    async addAthleteIdsToPlayerStats(payload, clubId) {
        if (!payload?.length)
            return;
        const apiPlayerIds = [
            ...new Set(payload.flatMap((g) => (g.playerStats ?? []).map((p) => p.apiPlayerId))),
        ];
        if (apiPlayerIds.length === 0)
            return;
        const providers = await AthleteProvider.query()
            .where('provider', ATHLETE_PROVIDER_TYPES.API_BASKETBALL)
            .whereIn('providerAthleteId', apiPlayerIds.map(String))
            .whereHas('athlete', (query) => query.where('clubId', clubId))
            .select('athleteId', 'providerAthleteId');
        const apiToAthlete = new Map(providers.map((provider) => [provider.providerAthleteId ?? '', provider.athleteId]));
        for (const game of payload) {
            for (const stat of game.playerStats ?? []) {
                stat.athleteId = apiToAthlete.get(String(stat.apiPlayerId)) ?? null;
            }
        }
    }
    async syncBasketballGamesWithEvents(games, clubId) {
        for (const game of games) {
            const eventType = await this.getBasketballEventType();
            if (!eventType)
                continue;
            try {
                if (game.eventId) {
                    const existingEvent = await Event.query()
                        .where('id', game.eventId)
                        .where('clubId', clubId)
                        .first();
                    if (existingEvent) {
                        await this.updateEventWithGameDetails(existingEvent, game);
                        continue;
                    }
                }
                const defaultEndTime = game.startTime.plus({ hours: 2 });
                const event = await this.findOrCreateMatchEvent({
                    game,
                    eventType,
                    clubId,
                    defaultEndTime,
                });
                const trx = await db.transaction();
                try {
                    await game.merge({ eventId: event.id }).useTransaction(trx).save();
                    await this.syncEventAthletesFromGame(event, game, clubId);
                    await this.linkSportActivitiesToEvent(event, game, clubId);
                    await trx.commit();
                }
                catch (error) {
                    await trx.rollback();
                    throw error;
                }
            }
            catch (error) {
                logger.error({ error, gameId: game.id, clubId }, 'Failed to sync basketball game with event');
            }
        }
    }
    async updateEventWithGameDetails(event, game) {
        const updates = {};
        if (!event.location && game.location) {
            updates.location = game.location;
        }
        if (Object.keys(updates).length > 0) {
            event.merge(updates);
            await event.save();
        }
    }
    async getAthleteIdsFromGameStats(gameId, teamId, clubId) {
        const statsResponse = await this.apiBasketballService.fetchGameStatistics(String(gameId));
        const teamStats = statsResponse.response.filter((entry) => entry.team.id === teamId);
        if (teamStats.length === 0)
            return [];
        const playerIds = teamStats.map((stat) => String(stat.player.id));
        const athleteProviders = await AthleteProvider.query()
            .where('provider', ATHLETE_PROVIDER_TYPES.API_BASKETBALL)
            .whereHas('athlete', (q) => q.where('clubId', clubId))
            .whereIn('providerAthleteId', playerIds)
            .preload('athlete');
        return athleteProviders.map((p) => p.athleteId).filter((id) => id !== null);
    }
    async syncEventAthletesFromGame(event, game, clubId) {
        try {
            const teamId = game.homeTeamId === JL_BOURG_TEAM_ID ? game.homeTeamId : game.awayTeamId;
            const fromStats = await this.getAthleteIdsFromGameStats(game.apiGameId, teamId, clubId);
            const periods = await Period.query()
                .where('providerId', String(game.apiGameId))
                .preload('sportActivity', (q) => q.preload('day'));
            const withPeriods = [
                ...new Set(periods
                    .map((p) => p.sportActivity?.day?.athleteId)
                    .filter((id) => id != null)),
            ];
            const toSync = [...new Set([...fromStats, ...withPeriods])];
            if (toSync.length > 0) {
                await event.related('athletes').sync(toSync);
            }
        }
        catch (error) {
            logger.error({ error, eventId: event.id, gameId: game.id }, 'Failed to sync event athletes from game stats');
        }
    }
    async linkPeriodActivitiesToEvent(event, game, clubId) {
        const periods = await Period.query()
            .where('providerId', String(game.apiGameId))
            .preload('sportActivity', (query) => {
            query.preload('day', (dayQuery) => {
                dayQuery.preload('athlete');
            });
        })
            .preload('metricValues', (metricQuery) => {
            metricQuery.preload('metric');
        });
        const sportActivityIds = periods
            .map((period) => period.sportActivity?.id)
            .filter((id) => id !== null && id !== undefined);
        if (sportActivityIds.length > 0) {
            await SportActivity.query()
                .whereIn('id', sportActivityIds)
                .whereHas('day', (query) => {
                query.whereHas('athlete', (athleteQuery) => {
                    athleteQuery.where('clubId', clubId);
                });
            })
                .update({ eventId: event.id });
        }
    }
    async linkGameActivitiesToEvent(event, game, dayIds) {
        if (dayIds.length === 0) {
            return;
        }
        const gameActivities = await SportActivity.query()
            .whereIn('dayId', dayIds)
            .where('gameActivity', true)
            .where((query) => {
            query.where('dataSource', 'api_basket').orWhere('dataSource', 'manual');
        })
            .where((query) => {
            query.whereNull('eventId').orWhere('eventId', event.id);
        })
            .preload('periods', (periodQuery) => {
            periodQuery
                .where('providerId', String(game.apiGameId))
                .preload('metricValues', (metricQuery) => {
                metricQuery.preload('metric');
            });
        });
        if (gameActivities.length > 0) {
            await SportActivity.query()
                .whereIn('id', gameActivities.map((a) => a.id))
                .update({ eventId: event.id });
        }
    }
    async ensureAllAthletesHaveActivity(event, game, athleteIds) {
        if (athleteIds.length === 0) {
            return;
        }
        const existingActivities = await SportActivity.query()
            .where('eventId', event.id)
            .whereHas('day', (query) => {
            query.whereIn('athleteId', athleteIds);
        })
            .preload('day');
        const athletesWithActivity = new Set(existingActivities.map((activity) => String(activity.day.athleteId)));
        const athletesWithoutActivity = athleteIds.filter((id) => !athletesWithActivity.has(id));
        if (athletesWithoutActivity.length === 0) {
            return;
        }
        const gameDate = game.startTime.startOf('day');
        const gameDateEnd = game.startTime.endOf('day');
        const days = await Day.query()
            .whereIn('athleteId', athletesWithoutActivity)
            .whereBetween('dateOfDay', [gameDate.toJSDate(), gameDateEnd.toJSDate()]);
        if (days.length === 0) {
            return;
        }
        const dayIds = days.map((day) => day.id);
        const existingActivitiesByDate = await SportActivity.query()
            .whereIn('dayId', dayIds)
            .where('activityTypeId', String(BASKETBALL_ACTIVITY_TYPE_ID))
            .where((query) => {
            query.where('dataSource', 'manual').orWhere('dataSource', 'api_basket');
        })
            .where((query) => {
            query.whereNull('eventId').orWhere('eventId', event.id);
        })
            .preload('day');
        const existingByDayId = new Map();
        const manualActivities = existingActivitiesByDate.filter((a) => a.dataSource === 'manual');
        const apiActivities = existingActivitiesByDate.filter((a) => a.dataSource === 'api_basket');
        for (const activity of [...manualActivities, ...apiActivities]) {
            if (!existingByDayId.has(activity.dayId)) {
                existingByDayId.set(activity.dayId, activity);
            }
        }
        const activitiesToLink = [];
        for (const athleteId of athletesWithoutActivity) {
            const day = days.find((d) => d.athleteId === athleteId);
            if (!day)
                continue;
            const existingActivity = existingByDayId.get(day.id);
            if (existingActivity && existingActivity.eventId !== event.id) {
                activitiesToLink.push(existingActivity.id);
            }
        }
        if (activitiesToLink.length > 0) {
            await SportActivity.query()
                .whereIn('id', activitiesToLink)
                .update({ eventId: event.id, gameActivity: true });
        }
    }
    async linkSportActivitiesToEvent(event, game, clubId) {
        try {
            const gameDate = game.startTime.startOf('day');
            const gameDateEnd = game.startTime.endOf('day');
            await this.linkPeriodActivitiesToEvent(event, game, clubId);
            const eventAthletes = await event.related('athletes').query();
            const athleteIds = eventAthletes.map((a) => a.id);
            if (athleteIds.length > 0) {
                const days = await Day.query()
                    .whereIn('athleteId', athleteIds)
                    .whereBetween('dateOfDay', [gameDate.toJSDate(), gameDateEnd.toJSDate()]);
                const dayIds = days.map((day) => day.id);
                await this.linkGameActivitiesToEvent(event, game, dayIds);
                await this.ensureAllAthletesHaveActivity(event, game, athleteIds.map(String));
            }
        }
        catch (error) {
            logger.error({ error, eventId: event.id, gameId: game.id }, 'Failed to link sport activities to event');
        }
    }
    async findOrCreateMatchEvent({ game, eventType, clubId, defaultEndTime, }) {
        if (game.apiGameId) {
            const existingWithSameGame = await Event.query()
                .where('clubId', clubId)
                .where('eventTypeId', eventType.id)
                .whereHas('basketballGames', (q) => q.where('apiGameId', game.apiGameId))
                .first();
            if (existingWithSameGame) {
                await this.updateEventWithGameDetails(existingWithSameGame, game);
                return existingWithSameGame;
            }
        }
        const gameDayStart = game.startTime.startOf('day').toJSDate();
        const existingWithoutGame = await Event.query()
            .where({ clubId })
            .whereHas('eventType', (query) => {
            query.where('eventCategory', EVENT_CATEGORY.MATCHES);
        })
            .whereBetween('startTime', [gameDayStart, game.startTime.endOf('day').toJSDate()])
            .doesntHave('basketballGames')
            .first();
        if (existingWithoutGame) {
            await this.updateEventWithGameDetails(existingWithoutGame, game);
            return existingWithoutGame;
        }
        return await Event.create({
            eventTypeId: eventType.id,
            startTime: game.startTime,
            endTime: defaultEndTime,
            title: game.title,
            location: game.location,
            clubId,
        });
    }
}
//# sourceMappingURL=api_basketball_service.js.map