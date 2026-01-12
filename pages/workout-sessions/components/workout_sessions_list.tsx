import { Clock, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { useTranslation } from "react-i18next";
import { getLocalizedName, getSupportedLanguage } from "../../../utils/language_config";
import type { Workout } from "../../../types/workout.types";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import UpsertWorkoutSession from "../upsert_workout_session";
import { useDeleteWorkout } from "../../../lib/query/workout/delete_workout";
import { useGetWorkouts } from "../../../lib/query/workout/get_workouts";

export const WorkoutSessionsList = ({
  setSelectedWorkout,
}: {
  setSelectedWorkout: (workout: Workout) => void;
}) => {
  const { t, i18n } = useTranslation("workout");
  const currentLanguage = getSupportedLanguage(i18n.language);

  const { data: workouts } = useGetWorkouts();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [workoutToEdit, setWorkoutToEdit] = useState<Workout | null>(null);
  const deleteWorkoutMutation = useDeleteWorkout();

  if (!workouts || workouts.length === 0) return null;

  const handleEditWorkout = (workout: Workout, e: React.MouseEvent) => {
    e.stopPropagation();
    setWorkoutToEdit(workout);
    setIsEditOpen(true);
  };

  const handleDeleteWorkout = (workout: Workout, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(t("session.deleteConfirm", { name: workout.name }))) {
      deleteWorkoutMutation.mutate(workout.id);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {workouts.map((workout) => (
          <Card
            key={workout.id}
            className="bg-[#252d3b] hover:bg-[#323d56] group hover:shadow-lg transition-all duration-300 cursor-pointer border-border/50"
            onClick={() => {
              setSelectedWorkout(workout);
            }}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">{workout.name}</CardTitle>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="text-slate-200 hover:text-white hover:bg-white/10 p-2 rounded"
                    aria-label={t("session.edit")}
                    onClick={(e) => handleEditWorkout(workout, e)}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-red-500/20 text-red-400 hover:text-red-300"
                    onClick={(e) => handleDeleteWorkout(workout, e)}
                    disabled={deleteWorkoutMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {/* <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(workout.date)}
              </div> */}
                {workout.duration && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {workout.duration} {t("session.minutes")}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 tracking-wide">
                    {t("session.exercisesCount", {
                      count: workout.exercises.length,
                    })}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {workout.exercises.map((exercise, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="text-xs px-2 py-1 bg-main-gray"
                      >
                        {getLocalizedName(exercise, currentLanguage)}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl">
              {workoutToEdit
                ? t("session.editSessionTitle", { name: workoutToEdit.name })
                : t("session.editSession")}
            </DialogTitle>
          </DialogHeader>
          <UpsertWorkoutSession setIsOpen={setIsEditOpen} workoutToEdit={workoutToEdit} />
        </DialogContent>
      </Dialog>
    </>
  );
};
