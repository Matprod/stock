import { createModelViewConfig } from '#adomin/create_model_view_config';
import { USER_ROLE } from '#constants/user.constants';
import Athlete from '#models_pg/athlete';
import BrevoService from '#services/brevo_service';
import string from '@adonisjs/core/helpers/string';
import hash from '@adonisjs/core/services/hash';
export const ATHLETE_VIEW = createModelViewConfig(() => Athlete, {
    label: 'Athlete',
    icon: 'barbell',
    queryBuilderCallback(q, ctx) {
        if (ctx.auth.user.role === USER_ROLE.SUPER_ADMIN) {
            return q;
        }
        return q.where('club_id', ctx.auth.user.clubId);
    },
    afterCreateCallback: async (entity, ctx) => {
        const password = entity.password ?? string.random(10);
        if (ctx.auth.user?.role === USER_ROLE.CLUB_ADMIN) {
            entity.clubId = ctx.auth.user?.clubId;
        }
        entity.password = await hash.make(password);
        entity.appLanguage = 'fr';
        await entity.save();
    },
    instanceActions: [
        {
            icon: 'mail',
            name: 'send-welcome-email',
            type: 'backend-action',
            tooltip: 'Send welcome email',
            action: async (ctx) => {
                const brevoService = new BrevoService();
                const athlete = await Athlete.findOrFail(ctx.params.id);
                const password = string.random(10);
                athlete.password = await hash.make(password);
                await athlete.save();
                await brevoService.sendEmail(athlete.email, 'WELCOME', {
                    email: athlete.email,
                    password: password,
                });
                return ctx.response.ok({ message: 'Welcome email sent' });
            },
        },
    ],
    columns: {
        firstName: {
            type: 'string',
            label: 'Prénom',
        },
        lastName: {
            type: 'string',
            label: 'Nom',
        },
        jerseyNumber: {
            type: 'number',
            label: 'Numéro de maillot',
            optional: true,
            min: 0,
        },
        club: {
            type: 'belongsToRelation',
            label: 'Club',
            modelName: 'Club',
            labelFields: ['name'],
            isVisible: async (ctx) => {
                return ctx.auth.user?.role === USER_ROLE.SUPER_ADMIN;
            },
            optional: true,
            size: 200,
        },
        email: {
            type: 'string',
            label: 'Email',
        },
        password: {
            type: 'string',
            label: 'Mot de passe',
            isPassword: true,
            isVisible: async (ctx) => {
                return ctx.auth.user?.role === USER_ROLE.SUPER_ADMIN;
            },
            optional: true,
        },
        gender: {
            type: 'enum',
            label: 'Sexe',
            options: [
                { label: 'Homme', value: 'male' },
                { label: 'Femme', value: 'female' },
            ],
        },
        birthDate: {
            type: 'date',
            subType: 'date',
            label: 'Date de naissance',
        },
        heightCm: {
            type: 'number',
            label: 'Taille (cm)',
            optional: true,
        },
        weightKg: {
            type: 'number',
            label: 'Poids (kg)',
            nullable: true,
        },
        playerPosition: {
            type: 'belongsToRelation',
            label: 'Position',
            modelName: 'PlayerPosition',
            labelFields: ['name'],
        },
        startDate: {
            type: 'date',
            subType: 'date',
            label: 'Date de début',
            optional: true,
        },
        endDate: {
            type: 'date',
            subType: 'date',
            label: 'Date de fin',
            optional: true,
        },
    },
});
//# sourceMappingURL=athlete_view.js.map