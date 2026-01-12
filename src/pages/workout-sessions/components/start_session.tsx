import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Dumbbell } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getSupportedLanguage } from "../../../utils/language_config";
import { Form } from "../../../components/ui/form";
import { Button } from "../../../components/ui/button";
import type { Dispatch, SetStateAction } from "react";
import type { APIWorkoutHistory, Workout } from "../../../types/workout.types";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type WorkoutSessionData, createWorkoutSessionSchema } from "../schemas/workout_schema";
import { useStartWorkout } from "../../../lib/query/workout/start_workout";
import { getDefaultValues } from "../utils/get_default_values";
import ExercisesConfiguration from "./start_session/exercises_configuration";
import DateConfiguration from "./start_session/date_configuration";
import PlayersConfiguration from "./start_session/players_configuration";
import { toast } from "react-toastify";

interface StartSessionProps {
  setSelectedWorkout: Dispatch<SetStateAction<Workout | null>>;
  selectedWorkout: Workout | null;
  setSelectedSession: Dispatch<SetStateAction<APIWorkoutHistory | null>>;
  selectedSession: APIWorkoutHistory | null;
}

export const StartSession = ({
  setSelectedWorkout,
  selectedWorkout,
  setSelectedSession,
  selectedSession,
}: StartSessionProps) => {
  const { t, i18n } = useTranslation("workout");
  const currentLanguage = getSupportedLanguage(i18n.language);

  const { mutateAsync: startWorkout, isPending } = useStartWorkout();

  const form = useForm<WorkoutSessionData>({
    resolver: zodResolver(createWorkoutSessionSchema(t)),
    defaultValues: getDefaultValues({ selectedSession, selectedWorkout, currentLanguage }),
  });

  const { handleSubmit } = form;

  const onSubmit = async (data: WorkoutSessionData) => {
    if (!selectedWorkout && !selectedSession) {
      return;
    }

    const [hours, minutes] = data.time.split(":").map(Number);
    const exerciceDateWithTime = new Date(data.date);
    exerciceDateWithTime.setHours(hours, minutes, 0, 0);

    const toastId = toast.loading(t("sessionStart.creating"));

    try {
      await startWorkout({
        workoutId: selectedWorkout?.id ?? selectedSession?.workoutSessionId ?? 0,
        startTime: exerciceDateWithTime.toISOString(),
        exercises: data.exercises.map((exercise) => ({
          id: exercise.id,
          sets: exercise.sets.map((set) => ({
            reps: set.reps || undefined,
            weight: set.weight || undefined,
            duration: set.duration || undefined,
            order: set.order,
          })),
        })),
        players: data.players,
        duration: selectedWorkout?.duration ?? selectedSession?.duration ?? 0,
      });

      toast.update(toastId, {
        render: t("sessionStart.success"),
        type: "success",
        isLoading: false,
        autoClose: 2500,
        closeOnClick: true,
      });

      setSelectedWorkout(null);
      setSelectedSession(null);
      return;
    } catch (error) {
      toast.update(toastId, {
        render: t("sessionStart.error"),
        type: "error",
        isLoading: false,
        autoClose: 3500,
        closeOnClick: true,
      });
    }
  };

  return (
    <Dialog
      open={selectedWorkout !== null || selectedSession !== null}
      onOpenChange={(open) => {
        if (!open) {
          setSelectedWorkout(null);
          setSelectedSession(null);
        }
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-normal">
            <Dumbbell className="h-5 w-5" />
            {t("sessionStart.title", {
              name: selectedWorkout?.name ?? selectedSession?.title ?? "",
            })}
          </DialogTitle>
          <DialogDescription>{t("sessionStart.description")}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <PlayersConfiguration />
            <DateConfiguration />
            <ExercisesConfiguration />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSelectedWorkout(null);
                  setSelectedSession(null);
                }}
              >
                {t("sessionStart.cancel")}
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isPending}>
                {t("sessionStart.startSession")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
