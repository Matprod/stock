import { ATHLETE_PROVIDER_SOURCE } from '#constants/athlete_provider.constants';
import Athlete from '#models_pg/athlete';
import Injury from '#models_pg/injury';
import InjuryType from '#models_pg/injury_type';
import { DateTime } from 'luxon';
export default class InjuryService {
    async getInjuryTypes(clubId) {
        return InjuryType.query()
            .where((q) => {
            q.whereNull('clubId').orWhere('clubId', clubId);
        })
            .preload('section', (sectionQuery) => {
            sectionQuery.preload('zone');
        });
    }
    async getInjuriesByClub(clubId, seasonStartDate, seasonEndDate, athleteId) {
        const injuryTable = Injury.table;
        const athleteTable = Athlete.table;
        const query = Injury.query()
            .join(athleteTable, `${athleteTable}.id`, '=', `${injuryTable}.athlete_id`)
            .where(`${athleteTable}.club_id`, clubId)
            .where((q) => {
            q.whereNull(`${athleteTable}.start_date`).orWhereColumn(`${athleteTable}.start_date`, '<=', `${injuryTable}.date_of_injury`);
        })
            .where((q) => {
            q.whereNull(`${athleteTable}.end_date`).orWhereColumn(`${athleteTable}.end_date`, '>=', `${injuryTable}.date_of_injury`);
        });
        if (seasonStartDate && seasonEndDate) {
            const seasonStart = seasonStartDate.toJSDate();
            const seasonEnd = seasonEndDate.toJSDate();
            query
                .where((q) => {
                q.whereNull(`${athleteTable}.start_date`).orWhere(`${athleteTable}.start_date`, '<=', seasonEnd);
            })
                .where((q) => {
                q.whereNull(`${athleteTable}.end_date`).orWhere(`${athleteTable}.end_date`, '>=', seasonStart);
            })
                .where(`${injuryTable}.date_of_injury`, '<=', seasonEnd)
                .where((q) => {
                q.whereNull(`${injuryTable}.recovery_date`).orWhere(`${injuryTable}.recovery_date`, '>=', seasonStart);
            });
        }
        return query
            .select(`${injuryTable}.*`)
            .preload('athlete', (athleteQuery) => {
            athleteQuery.preload('profilePicture');
        })
            .preload('injuryType', (injuryTypeQuery) => {
            injuryTypeQuery.preload('section', (sectionQuery) => {
                sectionQuery.preload('zone');
            });
        })
            .if(athleteId, (q) => {
            q.where(`${athleteTable}.id`, athleteId);
        })
            .orderBy(`${injuryTable}.date_of_injury`, 'desc');
    }
    async upsertInjury({ id, athleteId, injuryTypeId, startDate, endDate, context, note, clubId, }) {
        const athlete = await Athlete.query().where('id', athleteId).where('club_id', clubId).first();
        if (!athlete) {
            throw new Error('Athlete not found');
        }
        const isUpdate = Boolean(id);
        let injury = null;
        if (isUpdate) {
            injury = await Injury.query()
                .where('id', id)
                .whereHas('athlete', (athleteQuery) => {
                athleteQuery.where('club_id', clubId);
            })
                .first();
            if (!injury) {
                throw new Error('Injury not found');
            }
        }
        const payload = {
            athleteId,
            typeOfInjuryId: injuryTypeId,
            dateOfInjury: DateTime.fromISO(startDate),
            recoveryDate: endDate ? DateTime.fromISO(endDate) : null,
            context: context ?? null,
            note: note ?? null,
        };
        if (injury) {
            if (injury.source !== ATHLETE_PROVIDER_SOURCE.MANUAL) {
                if (athleteId !== injury.athleteId) {
                    throw new Error('Cannot reassign external injury to another athlete');
                }
                const requestedStart = DateTime.fromISO(startDate).toISODate();
                const existingStart = injury.dateOfInjury?.toISODate();
                if (requestedStart !== existingStart) {
                    throw new Error('Cannot change start date for external injury');
                }
                if (endDate !== undefined) {
                    const requestedEnd = endDate ? DateTime.fromISO(endDate).toISODate() : null;
                    const existingEnd = injury.recoveryDate?.toISODate() ?? null;
                    if (requestedEnd !== existingEnd) {
                        throw new Error('Cannot change end date for external injury');
                    }
                }
                if (injuryTypeId !== undefined && injuryTypeId !== injury.typeOfInjuryId) {
                    throw new Error('Cannot change injury type for external injury');
                }
                if (context !== undefined) {
                    injury.context = context ?? null;
                }
                if (note !== undefined) {
                    injury.note = note ?? null;
                }
                await injury.save();
                return injury;
            }
            injury.merge(payload);
            await injury.save();
            return injury;
        }
        return await Injury.create({
            ...payload,
            source: ATHLETE_PROVIDER_SOURCE.MANUAL,
        });
    }
    async deleteInjury(injuryId, clubId) {
        const injury = await Injury.query()
            .where('id', injuryId)
            .whereHas('athlete', (athleteQuery) => {
            athleteQuery.where('club_id', clubId);
        })
            .first();
        if (!injury) {
            throw new Error('Injury not found');
        }
        const isManual = injury.source === ATHLETE_PROVIDER_SOURCE.MANUAL;
        if (!isManual) {
            throw new Error('Cannot delete external injury');
        }
        const injuryData = {
            athleteId: injury.athleteId,
            startDate: injury.dateOfInjury,
            endDate: injury.recoveryDate,
            source: injury.source,
        };
        await injury.delete();
        return { success: true, injuryData };
    }
}
//# sourceMappingURL=injury_service.js.map