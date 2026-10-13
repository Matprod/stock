import { ATHLETE_PROVIDER_SOURCE } from '#constants/athlete_provider.constants';
import Athlete from '#models_pg/athlete';
import Disease from '#models_pg/disease';
import { DateTime } from 'luxon';
export default class DiseaseService {
    async getDiseasesByClub(clubId, seasonStartDate, seasonEndDate, athleteId) {
        const diseaseTable = Disease.table;
        const athleteTable = Athlete.table;
        const query = Disease.query()
            .join(athleteTable, `${athleteTable}.id`, '=', `${diseaseTable}.athlete_id`)
            .where(`${athleteTable}.club_id`, clubId)
            .where((q) => {
            q.whereNull(`${athleteTable}.start_date`).orWhereColumn(`${athleteTable}.start_date`, '<=', `${diseaseTable}.start_date`);
        })
            .where((q) => {
            q.whereNull(`${athleteTable}.end_date`).orWhereColumn(`${athleteTable}.end_date`, '>=', `${diseaseTable}.start_date`);
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
                .where(`${diseaseTable}.start_date`, '>=', seasonStart)
                .where(`${diseaseTable}.start_date`, '<=', seasonEnd);
        }
        return query
            .select(`${diseaseTable}.*`)
            .preload('athlete', (athleteQuery) => {
            athleteQuery.preload('profilePicture');
        })
            .if(athleteId, (q) => {
            q.where(`${athleteTable}.id`, athleteId);
        })
            .orderBy(`${diseaseTable}.start_date`, 'desc');
    }
    async upsertDisease({ id, athleteId, dateOfDisease, name, recoveryDate, note, clubId, }) {
        const athlete = await Athlete.query().where('id', athleteId).where('club_id', clubId).first();
        if (!athlete) {
            throw new Error('Athlete not found');
        }
        const isUpdate = Boolean(id);
        let disease = null;
        if (isUpdate) {
            disease = await Disease.query()
                .where('id', id)
                .whereHas('athlete', (athleteQuery) => {
                athleteQuery.where('club_id', clubId);
            })
                .first();
            if (!disease) {
                throw new Error('Disease not found');
            }
        }
        const payload = {
            athleteId,
            startDate: DateTime.fromISO(dateOfDisease),
            endDate: recoveryDate ? DateTime.fromISO(recoveryDate) : null,
            name,
            note: note ?? null,
        };
        if (disease) {
            if (disease.source !== ATHLETE_PROVIDER_SOURCE.MANUAL) {
                if (athleteId !== disease.athleteId) {
                    throw new Error('Cannot reassign external disease to another athlete');
                }
                const requestedDate = DateTime.fromISO(dateOfDisease).toISODate();
                const existingDate = disease.startDate?.toISODate();
                if (requestedDate !== existingDate) {
                    throw new Error('Cannot change date for external disease');
                }
                if (recoveryDate !== undefined) {
                    const requestedRecovery = recoveryDate ? DateTime.fromISO(recoveryDate).toISODate() : null;
                    const existingRecovery = disease.endDate?.toISODate() ?? null;
                    if (requestedRecovery !== existingRecovery) {
                        throw new Error('Cannot change recovery date for external disease');
                    }
                }
                if (name !== undefined && disease.name !== name) {
                    throw new Error('Cannot change name for external disease');
                }
                disease.note = payload.note;
                await disease.save();
                return disease;
            }
            disease.merge(payload);
            await disease.save();
            return disease;
        }
        return await Disease.create({
            ...payload,
            source: ATHLETE_PROVIDER_SOURCE.MANUAL,
        });
    }
    async deleteDisease(diseaseId, clubId) {
        const disease = await Disease.query()
            .where('id', diseaseId)
            .whereHas('athlete', (athleteQuery) => {
            athleteQuery.where('club_id', clubId);
        })
            .first();
        if (!disease) {
            throw new Error('Disease not found');
        }
        const isManual = disease.source === ATHLETE_PROVIDER_SOURCE.MANUAL;
        if (!isManual) {
            throw new Error('Cannot delete external disease');
        }
        const diseaseData = {
            athleteId: disease.athleteId,
            startDate: disease.startDate,
            endDate: disease.endDate,
            source: disease.source,
        };
        await disease.delete();
        return { success: true, diseaseData };
    }
}
//# sourceMappingURL=disease_service.js.map