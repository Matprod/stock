import { createModelViewConfig } from '#adomin/create_model_view_config';
import { USER_ROLE } from '#constants/user.constants';
import { EXERCISE_DIFFICULTY, EXERCISE_TYPE } from '#constants/workout.constants';
import ReinforcementExercise from '#models_pg/reinforcement_exercise';
export const REINFORCEMENT_EXERCICE_VIEW = createModelViewConfig(() => ReinforcementExercise, {
    label: 'Exercices',
    icon: 'barbell',
    afterValidatePayloadTransformCallback: async (payload, ctx) => {
        if (ctx.auth.user?.role !== USER_ROLE.SUPER_ADMIN) {
            payload.club = ctx.auth.user?.clubId;
        }
        return payload;
    },
    queryBuilderCallback: async (q, ctx) => {
        if (ctx.auth.user.role === USER_ROLE.SUPER_ADMIN) {
            return q;
        }
        return q.where('club_id', ctx.auth.user.clubId);
    },
    columns: {
        name: {
            type: 'string',
            label: 'Name',
        },
        type: {
            type: 'enum',
            label: 'Type',
            defaultValue: EXERCISE_TYPE.WEIGHTED_REPS,
            options: [
                { label: 'PDC (reps)', value: EXERCISE_TYPE.BODYWEIGHT_REPS },
                { label: 'PDC (temps)', value: EXERCISE_TYPE.BODYWEIGHT_TIME },
                { label: 'Avec poids (reps)', value: EXERCISE_TYPE.WEIGHTED_REPS },
                { label: 'Avec poids (temps)', value: EXERCISE_TYPE.WEIGHTED_TIME },
            ],
        },
        difficulty: {
            type: 'enum',
            label: 'Difficulté',
            options: [
                { label: 'Facile', value: EXERCISE_DIFFICULTY.EASY },
                { label: 'Moyen', value: EXERCISE_DIFFICULTY.MEDIUM },
                { label: 'Difficile', value: EXERCISE_DIFFICULTY.HARD },
            ],
            optional: true,
        },
        estimatedReps: {
            type: 'number',
            label: 'Nombre de répétitions estimé',
            nullable: true,
            optional: true,
        },
        estimatedDuration: {
            type: 'number',
            label: 'Durée estimée (secondes)',
            nullable: true,
            optional: true,
        },
        bodyweightPercentage: {
            type: 'number',
            label: 'Pourcentage de poids corporel',
            nullable: true,
            optional: true,
        },
        activity: {
            type: 'belongsToRelation',
            label: 'Activity',
            modelName: 'Activity',
            labelFields: ['name'],
            preload: true,
        },
        videoLink: {
            type: 'string',
            label: 'Video Link',
            nullable: true,
        },
        club: {
            isVisible: async (ctx) => {
                return ctx.auth.user?.role === USER_ROLE.SUPER_ADMIN;
            },
            type: 'belongsToRelation',
            label: 'Club',
            modelName: 'Club',
            labelFields: ['name'],
            optional: true,
        },
    },
});
//# sourceMappingURL=exercice_view.js.map