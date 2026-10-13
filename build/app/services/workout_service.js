import Day from '#models_pg/day';
import Event from '#models_pg/event';
import Club from '#models_pg/club';
import ReinforcementExercise from '#models_pg/reinforcement_exercise';
import SportActivity from '#models_pg/sport_activity';
import SportActivityExerciseSet from '#models_pg/exercise_set';
import WorkoutSession from '#models_pg/workout_session';
import WorkoutExerciseFavorite from '#models_pg/workout_exercise_favorite';
import { DateTime } from 'luxon';
import { SportActivityService } from '#services/sport_activity_service';
import WorkoutSessionInstance from '#models_pg/workout_session_instance';
import db from '@adonisjs/lucid/services/db';
import { EVENT_CATEGORY } from '#constants/event.constants';
import { WORKOUT_HISTORY_CURSOR_PAGE_SIZE } from '#constants/workout.constants';
export class WorkoutService {
    sportActivityService;
    constructor() {
        this.sportActivityService = new SportActivityService();
    }
    async getAllWorkoutExercices(clubId, userId) {
        const exercises = await ReinforcementExercise.query()
            .where('clubId', clubId)
            .preload('activity')
            .preload('workoutExerciseFavorites', (query) => {
            query.where('userId', userId);
        });
        exercises.forEach((exercise) => {
            exercise.$extras.favorite = exercise.workoutExerciseFavorites.length > 0;
        });
        return exercises;
    }
    async toggleExerciseFavorite(userId, clubId, exerciseId, favorite) {
        const exercise = await ReinforcementExercise.query()
            .where('id', exerciseId)
            .where('clubId', clubId)
            .firstOrFail();
        if (favorite) {
            await WorkoutExerciseFavorite.firstOrCreate({ userId, exerciseId });
        }
        else {
            await WorkoutExerciseFavorite.query()
                .where('userId', userId)
                .where('exerciseId', exerciseId)
                .delete();
        }
        exercise.$extras.favorite = favorite;
        return exercise;
    }
    async getAllWorkouts(clubId, filters) {
        const query = WorkoutSession.query().where('clubId', clubId).preload('exercises');
        if (filters?.searchQuery) {
            query.whereILike('name', `%${filters.searchQuery}%`);
        }
        if (filters?.exerciseId) {
            query.whereHas('exercises', (q) => {
                q.where('id', filters.exerciseId);
            });
        }
        return query;
    }
    async createWorkout({ name, exerciseIds, durationSeconds, id, clubId, }) {
        const normalizedName = name.trim().toLowerCase();
        if (id) {
            const workout = await WorkoutSession.query().where('id', id).where('clubId', clubId).first();
            if (!workout) {
                throw new Error('Workout not found');
            }
            const nameTaken = await this.workoutWithNameExists(clubId, normalizedName, workout.id);
            if (nameTaken) {
                throw new Error('WORKOUT_NAME_ALREADY_EXISTS');
            }
            await workout.merge({ name: name.trim(), durationSeconds: durationSeconds ?? null }).save();
            await workout.related('exercises').sync(exerciseIds);
            return workout;
        }
        else {
            const nameTaken = await this.workoutWithNameExists(clubId, normalizedName);
            if (nameTaken) {
                throw new Error('WORKOUT_NAME_ALREADY_EXISTS');
            }
            const workout = await WorkoutSession.create({
                name: name.trim(),
                clubId,
                durationSeconds: durationSeconds ?? null,
            });
            await workout.related('exercises').attach(exerciseIds);
            return workout;
        }
    }
    async workoutWithNameExists(clubId, normalizedName, excludeWorkoutId) {
        const query = WorkoutSession.query().where('clubId', clubId);
        if (excludeWorkoutId !== undefined) {
            query.whereNot('id', excludeWorkoutId);
        }
        const workouts = await query.select('name');
        return workouts.some((workout) => workout.name.trim().toLowerCase() === normalizedName);
    }
    async startWorkout({ workoutId, startTime, exercises, players, durationSeconds, clubId, createEvent = true, }) {
        const utcDateTime = DateTime.fromISO(startTime, { zone: 'utc' });
        const trx = await db.transaction();
        try {
            const { activityId, eventType } = await this.resolveWorkoutActivityAndEventType(clubId, exercises.map((exercise) => exercise.id), trx);
            const workoutSession = await WorkoutSession.query({ client: trx })
                .where('id', workoutId)
                .andWhere('clubId', clubId)
                .first();
            if (!workoutSession) {
                throw new Error('Workout session not found');
            }
            const workoutSessionInstance = await WorkoutSessionInstance.create({
                startTime: utcDateTime,
                durationSeconds: durationSeconds ?? null,
                title: workoutSession.name,
                workoutSessionId: workoutSession.id,
            }, { client: trx });
            await Promise.all(exercises.map(async (exercise) => {
                await Promise.all(exercise.sets.map(async (set, setIndex) => {
                    await SportActivityExerciseSet.create({
                        workoutSessionInstanceId: workoutSessionInstance.id,
                        exerciseId: exercise.id,
                        reps: set.reps ?? null,
                        durationSeconds: set.durationSeconds ?? null,
                        weight: set.weight ?? null,
                        setOrder: setIndex + 1,
                        order: set.order,
                    }, { client: trx });
                }));
            }));
            const createdSportActivityIds = [];
            await Promise.all(players.map(async (playerId) => {
                let day = await Day.query({ client: trx })
                    .where('athleteId', playerId)
                    .where('dateOfDay', utcDateTime.toFormat('yyyy-MM-dd'))
                    .first();
                if (!day) {
                    day = await Day.create({
                        athleteId: playerId,
                        dateOfDay: utcDateTime,
                    }, { client: trx });
                }
                const sportActivity = await SportActivity.create({
                    timeOfActivity: utcDateTime.toFormat('HH:mm:ss'),
                    dataSource: 'manual',
                    dayId: day.id,
                    activityTypeId: activityId,
                    durationSeconds: durationSeconds ?? null,
                    workoutSessionInstanceId: workoutSessionInstance.id,
                }, { client: trx });
                createdSportActivityIds.push(sportActivity.id);
                await Promise.all(exercises.map(async (exercise, exerciseIndex) => {
                    await Promise.all(exercise.sets.map(async (set, setIndex) => {
                        await SportActivityExerciseSet.create({
                            sportActivityId: sportActivity.id,
                            exerciseId: exercise.id,
                            reps: set.reps ?? null,
                            durationSeconds: set.durationSeconds ?? null,
                            weight: set.weight ?? null,
                            setOrder: setIndex + 1,
                            order: exerciseIndex + 1,
                        }, { client: trx });
                    }));
                }));
            }));
            if (createEvent) {
                const event = await Event.create({
                    eventTypeId: eventType.id,
                    startTime: utcDateTime,
                    endTime: durationSeconds != null
                        ? utcDateTime.plus({ seconds: durationSeconds })
                        : utcDateTime,
                    title: workoutSession.name,
                    location: null,
                    clubId,
                }, { client: trx });
                await event.related('athletes').sync(players);
                await SportActivity.query({ client: trx })
                    .whereIn('id', createdSportActivityIds)
                    .update({ eventId: event.id });
            }
            await trx.commit();
            await Promise.all(createdSportActivityIds.map(async (id) => {
                const trainingLoad = await this.sportActivityService.calculateTrainingLoad(id);
                const activity = await SportActivity.find(id);
                if (activity) {
                    await activity.merge({ trainingLoad }).save();
                }
            }));
            return workoutSessionInstance;
        }
        catch (error) {
            await trx.rollback();
            throw error;
        }
    }
    async deleteWorkout({ workoutId, clubId, }) {
        return WorkoutSession.query().where('id', workoutId).where('clubId', clubId).delete();
    }
    async getWorkoutsHistory(clubId, seasonStartDate, seasonEndDate, payload) {
        const query = WorkoutSessionInstance.query()
            .whereHas('workoutSession', (workoutSessionQuery) => {
            workoutSessionQuery.where('clubId', clubId);
        })
            .preload('sportActivities', (sportActivitiesQuery) => {
            sportActivitiesQuery.preload('day');
            sportActivitiesQuery.preload('exerciseSets', (exerciseSetsQuery) => {
                exerciseSetsQuery.preload('exercise');
            });
        })
            .preload('exercises', (exercisesQuery) => {
            exercisesQuery.preload('exercise');
        })
            .orderBy('startTime', 'desc')
            .limit(WORKOUT_HISTORY_CURSOR_PAGE_SIZE)
            .offset(payload?.cursor ?? 0);
        if (seasonStartDate && seasonEndDate) {
            query
                .where('startTime', '>=', seasonStartDate.toJSDate())
                .where('startTime', '<=', seasonEndDate.toJSDate());
        }
        if (payload?.searchQuery) {
            query.whereHas('workoutSession', (q) => {
                q.whereILike('name', `%${payload.searchQuery}%`);
            });
        }
        if (payload?.playerId) {
            query.whereHas('sportActivities', (q) => {
                q.whereHas('day', (aq) => {
                    aq.where('athleteId', payload.playerId);
                });
            });
        }
        if (payload?.exerciseId) {
            query.whereHas('exercises', (q) => {
                q.where('exerciseId', payload.exerciseId);
            });
        }
        if (payload?.sportId) {
            query.whereHas('exercises', (q) => {
                q.whereIn('exerciseId', ReinforcementExercise.query().select('id').where('activityId', payload.sportId));
            });
        }
        if (payload?.from) {
            const fromDate = DateTime.fromISO(payload.from).startOf('day');
            if (fromDate.isValid) {
                query.where('startTime', '>=', fromDate.toJSDate());
            }
        }
        if (payload?.to) {
            const toDate = DateTime.fromISO(payload.to).endOf('day');
            if (toDate.isValid) {
                query.where('startTime', '<=', toDate.toJSDate());
            }
        }
        const data = await query;
        const currentOffset = payload?.cursor ?? 0;
        const nextCursor = data.length === WORKOUT_HISTORY_CURSOR_PAGE_SIZE
            ? currentOffset + WORKOUT_HISTORY_CURSOR_PAGE_SIZE
            : null;
        return { data, meta: { nextCursor } };
    }
    async resolveWorkoutActivityAndEventType(clubId, exerciseIds, trx) {
        const firstExerciseId = exerciseIds[0];
        if (!firstExerciseId) {
            throw new Error('No exercises provided for the workout');
        }
        const exercise = await ReinforcementExercise.query({ client: trx })
            .where('id', firstExerciseId)
            .where('clubId', clubId)
            .first();
        if (!exercise?.activityId) {
            throw new Error('No activity found for the exercises');
        }
        const club = await Club.query({ client: trx })
            .where('id', clubId)
            .preload('eventTypes')
            .firstOrFail();
        const eventType = club.eventTypes.find((type) => type.eventCategory === EVENT_CATEGORY.TRAINING && type.activityId === exercise.activityId);
        if (!eventType) {
            throw new Error(`No training event type linked to this club for activity ${exercise.activityId}`);
        }
        return { activityId: exercise.activityId, eventType };
    }
}
//# sourceMappingURL=workout_service.js.map