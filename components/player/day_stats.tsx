import dayjs, { type Dayjs } from "dayjs";
import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import CircularProgress from "../../components/ui/circular_progress";
import { DateNavigation } from "../../components/ui/date-navigation";
import type { IPlayer } from "../../types/player.types";
import { getCircularProgressColor } from "../../utils/circular_progress";
import { StatCard } from "./stat_card";
import { useDateStore } from "../../store/date-store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import type { INote } from "../../types/notes";
import { useAddNote, useGetNotes, useUpdateNote } from "../../lib/query/notes/useNotes";

interface IDayStatsProps {
  days: Array<IPlayer["days"][number]>;
  type: "injury" | "performance";
  playerId: number;
}

export const DayStats = ({ days, type, playerId }: IDayStatsProps) => {
  const { athleteDate, setAthleteDate, setTeamDate } = useDateStore();
  const { t } = useTranslation("player");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [editingNote, setEditingNote] = useState<INote | null>(null);
  const { mutate: updateNote } = useUpdateNote();
  const { mutate: addNote } = useAddNote();
  const { data: notes } = useGetNotes();

  const daysWithStats = useMemo<Dayjs[]>(() => {
    return days.map((day) => dayjs(day.dateOfDay)).sort((a, b) => a.diff(b));
  }, [days]);

  const [currentDayIndex, setCurrentDayIndex] = useState(() => {
    if (athleteDate && daysWithStats.length > 0) {
      const storedDate = dayjs(athleteDate);
      const index = daysWithStats.findIndex((date) => date.isSame(storedDate, "day"));
      return index !== -1 ? index : daysWithStats.length - 1;
    }
    return daysWithStats.length - 1;
  });

  const selectedDate = daysWithStats[currentDayIndex];
  const selectedDay = days.find((day) => dayjs(day.dateOfDay).isSame(selectedDate, "day"));

  useEffect(() => {
    if (selectedDate) {
      setAthleteDate(selectedDate.format("YYYY-MM-DD"));
      setTeamDate(selectedDate.format("YYYY-MM-DD"));
    }
  }, [selectedDate, setAthleteDate, setTeamDate]);

  const handlePreviousDay = () => {
    if (currentDayIndex > 0) {
      setCurrentDayIndex(currentDayIndex - 1);
    }
  };

  const handleNextDay = () => {
    if (currentDayIndex < daysWithStats.length - 1) {
      setCurrentDayIndex(currentDayIndex + 1);
    }
  };

  const handleDateChange = (newDate: Dayjs) => {
    const newIndex = daysWithStats.findIndex((date) => date.isSame(newDate, "day"));
    if (newIndex !== -1) {
      setCurrentDayIndex(newIndex);
    }
  };

  const getLabel = (score: number, labelType: "injury" | "performance") => {
    if (labelType === "performance") {
      if (score >= 70) return t("stats.highPerformance");
      if (score >= 40) return t("stats.mediumPerformance");
      return t("stats.lowPerformance");
    }
    if (labelType === "injury") {
      if (score >= 20) return t("stats.highRisk");
      if (score < 10) return t("stats.readyToPlay");
      return t("stats.moderateRisk");
    }
  };

  const notesForDate = (notes ?? []).filter(
    (note) => dayjs(note.noteDate).isSame(selectedDate, "day") && note.athleteId === playerId,
  );

  const noteForDate =
    (notes ?? []).find(
      (note) => dayjs(note.noteDate).isSame(selectedDate, "day") && note.athleteId === playerId,
    ) || null;

  const openAddOrEditDialog = () => {
    if (noteForDate) {
      setNewNoteContent(noteForDate.content);
      setEditingNote(noteForDate);
    } else {
      setNewNoteContent("");
      setEditingNote(null);
    }
    setIsModalOpen(true);
  };

  const handleSaveNote = () => {
    if (!newNoteContent.trim()) {
      return;
    }

    if (editingNote) {
      updateNote(
        { noteId: editingNote.id, data: { content: newNoteContent } },
        {
          onSuccess: () => {
            setNewNoteContent("");
            setIsModalOpen(false);
            setEditingNote(null);
          },
        },
      );
    } else {
      addNote(
        {
          athleteId: playerId,
          noteDate: selectedDate.format("YYYY-MM-DD"),
          content: newNoteContent,
        },
        {
          onSuccess: () => {
            setNewNoteContent("");
            setIsModalOpen(false);
            setEditingNote(null);
          },
        },
      );
    }
  };

  const injuryScore = selectedDay?.injuryScore === 0 ? 1 : (selectedDay?.injuryScore ?? undefined);

  return (
    <div className="card w-full flex flex-col items-center bg-[#252d3b] rounded-3xl">
      <div className="w-full bg-[#252d3b] border-b border-[#3a4454] px-6 pb-4 flex justify-center items-center rounded-t-3xl">
        <div className="bg-[#252d3b] rounded-2xl shadow-md border border-[#3a4454] p-3">
          <DateNavigation
            daysWithStats={daysWithStats}
            selectedDate={selectedDate}
            currentDayIndex={currentDayIndex}
            onPreviousDay={handlePreviousDay}
            onNextDay={handleNextDay}
            onDateChange={handleDateChange}
            type="athlete"
          />
        </div>
      </div>
      <div className="flex flex-col w-full">
        <div className="flex flex-row items-center w-full p-8">
          <div className="grid grid-cols-2 gap-6 w-1/2">
            <StatCard
              title={t("stats.activity")}
              value={
                type === "performance"
                  ? selectedDay?.activityFinalScore
                  : selectedDay?.injuryActivityScore
              }
              link={`/player/${playerId}/summary?type=activity&category=${type}`}
            />
            <StatCard
              title={t("stats.sleep")}
              value={
                type === "performance"
                  ? selectedDay?.sleepFinalScore
                  : selectedDay?.injurySleepScore
              }
              link={`/player/${playerId}/summary?type=sleep&category=${type}`}
            />
            <StatCard
              title={t("stats.nutrition")}
              value={
                type === "performance" || selectedDay?.injuryScore
                  ? selectedDay?.dailyAverage?.nutriScore
                  : undefined
              }
              link={`/player/${playerId}/summary?type=nutrition&category=${type}`}
            />
            <StatCard
              title={t("stats.health")}
              value={
                type === "performance"
                  ? selectedDay?.healthFinalScore
                  : selectedDay?.injuryHealthScore
              }
              link={`/player/${playerId}/summary?type=health&category=${type}`}
            />
          </div>
          <div className="flex flex-row items-center justify-center w-1/2">
            {type === "injury" ? (
              <div className="flex flex-col items-center gap-y-4">
                <p className="font-medium text-center text-xl text-gray-100">
                  {t("stats.injuryRisk")}
                </p>
                <CircularProgress
                  progress={injuryScore}
                  color={getCircularProgressColor(injuryScore, "injury")}
                />
                <p className="text-sm font-medium text-gray-400">
                  {typeof injuryScore === "number"
                    ? getLabel(injuryScore, "injury")
                    : t("stats.noData")}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-y-4">
                <p className="font-medium text-center text-xl text-gray-100">
                  {t("stats.performance")}
                </p>
                <CircularProgress
                  progress={selectedDay?.finalScore ?? undefined}
                  color={getCircularProgressColor(
                    selectedDay?.finalScore ?? undefined,
                    "performance",
                  )}
                />
                <p className="text-sm font-medium text-gray-400">
                  {typeof selectedDay?.finalScore === "number"
                    ? getLabel(selectedDay.finalScore, "performance")
                    : t("stats.noData")}
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="px-8 pb-8">
          <div className="border-t border-[#3a4454] pt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium text-lg text-gray-100">{t("notes.title")}</h3>
              <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogTrigger asChild>
                  <Button
                    className="text-emerald-400 hover:bg-white/10"
                    variant="outline"
                    onClick={openAddOrEditDialog}
                  >
                    {noteForDate ? t("notes.editNote") : t("notes.addNote")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {noteForDate ? t("notes.editNote") : t("notes.addNote")}
                    </DialogTitle>
                    <DialogDescription>
                      {noteForDate ? t("notes.editNote") : t("notes.addNote")}{" "}
                      {selectedDate ? selectedDate.format("MMMM D, YYYY") : ""}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <Textarea
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      placeholder={t("notes.enterNoteContent")}
                      className="min-h-[100px] w-full bg-[#252d3b] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsModalOpen(false);
                        setEditingNote(null);
                      }}
                    >
                      {t("notes.cancel")}
                    </Button>
                    <Button variant="outline" onClick={handleSaveNote}>
                      {t("notes.saveNote")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="space-y-3">
              {notesForDate.map((note) => (
                <div key={note.id} className="p-4 bg-[#323d56] rounded-xl">
                  <p className="text-white text-sm mt-2 whitespace-pre-wrap ">{note.content}</p>
                </div>
              ))}
              {notesForDate.length === 0 && (
                <p className="text-sm text-gray-400">{t("notes.noNotes")}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
