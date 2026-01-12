import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader } from "../../components/ui/loader";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import { CalendarIcon, Pencil, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Textarea } from "../../components/ui/textarea";
import type { INoteWithAthlete } from "../../types/notes";
import FilterControls from "../../components/ui/filter_controls";
import { useDeleteNote, useGetNotes, useUpdateNote } from "../../lib/query/notes/useNotes";
import type { DateRange } from "../../components/ui/date-range-picker";

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

interface GroupedNotes {
  [date: string]: INoteWithAthlete[];
}

const NotesPage = () => {
  const { data: notes = [], isLoading, error } = useGetNotes();
  const { mutate: updateNote } = useUpdateNote();
  const { mutate: deleteNote } = useDeleteNote();
  const [dateRange, setDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });
  const [selectedPlayer, setSelectedPlayer] = useState<string | undefined>(undefined);
  const { t } = useTranslation("notes");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<INoteWithAthlete | null>(null);
  const [editContent, setEditContent] = useState("");

  const uniquePlayers = Array.from(new Set(notes.map((note) => note.athleteName))).sort();

  const filteredNotes = notes.filter((note) => {
    const noteDate = dayjs(note.noteDate);
    const isInDateRange =
      (!dateRange.from || noteDate.isSameOrAfter(dateRange.from, "day")) &&
      (!dateRange.to || noteDate.isSameOrBefore(dateRange.to, "day"));
    const isPlayerMatch = !selectedPlayer || note.athleteName === selectedPlayer;
    return isInDateRange && isPlayerMatch;
  });

  const groupedNotes = filteredNotes.reduce((groups: GroupedNotes, note) => {
    const date = dayjs(note.noteDate).format("YYYY-MM-DD");
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(note);
    return groups;
  }, {});

  const sortedDates = Object.keys(groupedNotes).sort(
    (a, b) => dayjs(b).valueOf() - dayjs(a).valueOf(),
  );

  const clearFilters = () => {
    setDateRange({ from: undefined, to: undefined });
    setSelectedPlayer(undefined);
  };

  const handleEdit = (note: INoteWithAthlete) => {
    setEditingNote(note);
    setEditContent(note.content);
    setEditDialogOpen(true);
  };

  if (isLoading) {
    return <Loader />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-destructive">Failed to load notes. Please try again later.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-y-8">
      <h1 className="font-medium text-white-400 text-4xl text-center mb-4">{t("title")}</h1>

      <div className="border border-[#3a4454] rounded-2xl bg-[#252d3b] p-4">
        <div className="flex items-center justify-between">
          <div className="flex">
            <p className="text-lg font-medium text-gray-100">All Notes</p>
          </div>

          <FilterControls
            dateRange={dateRange}
            setDateRange={setDateRange}
            selectedPlayer={selectedPlayer}
            setSelectedPlayer={setSelectedPlayer}
            uniquePlayers={uniquePlayers}
            onClearFilters={clearFilters}
          />
        </div>
      </div>

      {sortedDates.length === 0 ? (
        <p className="text-center text-muted-foreground">{t("noNotes")}</p>
      ) : (
        sortedDates.map((date) => (
          <div key={date} className="space-y-4">
            <h2 className="text-lg font-medium text-blue-200 flex items-center">
              <span className="mr-2">
                <CalendarIcon className="w-5 h-5" color="#bfdbfe" />
              </span>
              {dayjs(date).format("MMMM D, YYYY")}
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {groupedNotes[date].map((note) => (
                <div
                  key={note.id}
                  className="bg-[#2a3347] hover:bg-[#323d56] rounded-2xl p-6 flex flex-col relative"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="font-medium text-xl text-gray-100 block">
                        {note.athleteName}
                      </span>
                      {/* <span className="text-sm font-medium text-gray-400 block">
                        {dayjs(note.noteDate).format("D MMMM YYYY")}
                      </span> */}
                    </div>
                    <div className="flex gap-4 items-center">
                      <button
                        type="button"
                        className="text-slate-200 hover:text-white transition hover:bg-white/10 p-2 rounded"
                        onClick={() => handleEdit(note)}
                        aria-label="Edit note"
                      >
                        <Pencil size={20} />
                      </button>
                      <button
                        type="button"
                        className="text-slate-200 hover:text-red-400 transition hover:bg-red-500/20 p-2 rounded"
                        aria-label="Delete note"
                        onClick={() => deleteNote({ noteId: note.id })}
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                  <div className="p-4 bg-[#323d56] rounded-xl mt-3">
                    <p className="text-white text-sm whitespace-pre-wrap">{note.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-black text-white">
          <DialogHeader>
            <DialogTitle>{t("editNote")}</DialogTitle>
            <DialogDescription>
              {editingNote && dayjs(editingNote.noteDate).format("D MMMM YYYY")}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder={t("editYourNote")}
              className="min-h-[100px] w-full bg-[#252d3b] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              onClick={() => {
                if (editingNote) {
                  updateNote(
                    { noteId: editingNote.id, data: { content: editContent } },
                    {
                      onSuccess: () => {
                        setEditDialogOpen(false);
                      },
                    },
                  );
                }
              }}
            >
              {t("saveNote")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NotesPage;
