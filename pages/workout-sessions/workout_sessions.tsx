import { useState } from "react";
import { Button } from "../../components/ui/button";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import { Plus } from "lucide-react";
import UpsertWorkoutSession from "./upsert_workout_session";
import { WorkoutSessionsList } from "./components/workout_sessions_list";
import WorkoutHistoryList from "./components/workout_history_list";
import { twMerge } from "tailwind-merge";
import type { APIWorkoutHistory, Workout } from "../../types/workout.types";
import { StartSession } from "./components/start_session";

const WorkoutSessionsPage = () => {
  const { t } = useTranslation("workout");
  const [isOpen, setIsOpen] = useState(false);
  const [viewType, setViewType] = useState<"list" | "history">("list");
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [selectedSession, setSelectedSession] = useState<APIWorkoutHistory | null>(null);

  return (
    <>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">{t("page.title")}</h1>
          <div className="flex flex-row gap-x-2 items-center">
            <div className="flex items-center gap-2">
              <Button
                variant={viewType === "list" ? "default" : "outline"}
                className={twMerge(viewType === "list" && "bg-white text-black hover:bg-white/90")}
                onClick={() => setViewType("list")}
              >
                {t("page.library")}
              </Button>
              <Button
                variant={viewType === "history" ? "default" : "outline"}
                className={twMerge(
                  viewType === "history" && "bg-white text-black hover:bg-white/90",
                )}
                onClick={() => setViewType("history")}
              >
                {t("page.history")}
              </Button>
            </div>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4" />
                  {t("page.addSession")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="text-xl">{t("page.addNewSession")}</DialogTitle>
                  <DialogDescription>
                    Créer une nouvelle séance d'entraînement avec des exercices et des joueurs
                    participants.
                  </DialogDescription>
                </DialogHeader>
                <UpsertWorkoutSession setIsOpen={setIsOpen} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {viewType === "list" ? (
          <WorkoutSessionsList setSelectedWorkout={setSelectedWorkout} />
        ) : (
          <WorkoutHistoryList setSelectedSession={setSelectedSession} />
        )}
      </div>
      {(selectedWorkout || selectedSession) && (
        <StartSession
          setSelectedWorkout={setSelectedWorkout}
          selectedWorkout={selectedWorkout}
          setSelectedSession={setSelectedSession}
          selectedSession={selectedSession}
        />
      )}
    </>
  );
};

export default WorkoutSessionsPage;
