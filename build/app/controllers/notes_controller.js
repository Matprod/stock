import Athlete from '#models_pg/athlete';
import { addNoteSchema, getAllNotesQuerySchema, noteIdParamsSchema, updateNoteSchema, } from '#schemas/note';
import { NoteService } from '#services/note_service';
import SeasonService from '#services/season_service';
import PlayerNote from '#models_pg/player_note';
import { DateTime } from 'luxon';
import vine from '@vinejs/vine';
export default class NotesController {
    noteService;
    seasonService;
    constructor() {
        this.noteService = new NoteService();
        this.seasonService = new SeasonService();
    }
    async addNote({ request, response, auth }) {
        const payload = await addNoteSchema.validate(request.body());
        const clubId = auth.user.clubId;
        const athlete = await Athlete.find(payload.athleteId);
        if (!athlete || athlete.clubId !== clubId) {
            return response.notFound({ message: 'Athlete not found' });
        }
        try {
            const note = await this.noteService.createNoteForAthlete(payload);
            return response.created(note);
        }
        catch (error) {
            return response.badRequest({ message: error.message });
        }
    }
    async updateNote({ params, request, response, auth }) {
        const { noteId } = await noteIdParamsSchema.validate(params);
        const { content, category, noteDate } = await updateNoteSchema.validate(request.body());
        const clubId = auth.user.clubId;
        const currentNote = await PlayerNote.query().where('id', noteId).preload('athlete').first();
        if (!currentNote || currentNote.athlete.clubId !== clubId) {
            return response.notFound({ message: 'Note not found' });
        }
        const parsedNoteDate = noteDate ? DateTime.fromFormat(noteDate, 'yyyy-MM-dd') : undefined;
        try {
            const note = await this.noteService.updateNoteForAthlete({
                noteId,
                content,
                category,
                noteDate: parsedNoteDate,
            });
            return response.ok(note);
        }
        catch (error) {
            return response.notFound({ message: error.message });
        }
    }
    async getAllNotes({ response, auth, request }) {
        const filters = await getAllNotesQuerySchema.validate(request.qs());
        const clubId = auth.user.clubId;
        const seasonInfo = await this.seasonService.getSeasonFromRequest(request, clubId);
        try {
            const notes = await this.noteService.getAllNotesForClub(clubId, filters, seasonInfo.seasonStartDate, seasonInfo.seasonEndDate);
            return response.ok(notes);
        }
        catch (error) {
            return response.badRequest({ message: error.message });
        }
    }
    async deleteNote({ params, response, auth }) {
        const { noteId } = await vine.validate({
            schema: vine.object({ noteId: vine.string() }),
            data: params,
        });
        const clubId = auth.user.clubId;
        const currentNote = await PlayerNote.query().where('id', noteId).preload('athlete').first();
        if (!currentNote || currentNote.athlete.clubId !== clubId) {
            return response.notFound({ message: 'Note not found' });
        }
        await this.noteService.deleteNoteForAthlete({ noteId });
        return response.ok({ message: 'Note deleted' });
    }
}
//# sourceMappingURL=notes_controller.js.map