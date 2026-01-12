import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { getLocalizedName, getSupportedLanguage } from "../../utils/language_config";
import { Check, X } from "lucide-react";
import { useState, useMemo, type Dispatch, type SetStateAction, useEffect } from "react";
import i18n from "../../i18n";
import { Popover, PopoverTrigger, PopoverContent } from "@radix-ui/react-popover";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  Form,
} from "../../components/ui/form";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { useGetWorkoutsExercices } from "../../lib/query/workout/get_workouts_exercices";
import { type WorkoutFormData, createWorkoutSchema } from "./schemas/workout_schema";

import { useUpsertWorkout } from "../../lib/query/workout/upsert_workout";
import { NumberInputRhf } from "../../components/forms/number_input_rhf";
import { InputRhf } from "../../components/forms/input_rhf";
import type { Workout } from "../../types/workout.types";

interface UpsertWorkoutSessionProps {
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  workoutToEdit?: Workout | null;
}

const UpsertWorkoutSession = ({ setIsOpen, workoutToEdit }: UpsertWorkoutSessionProps) => {
  const { t } = useTranslation("workout");
  const currentLanguage = getSupportedLanguage(i18n.language);
  const [open, setOpen] = useState(false);

  const form = useForm<WorkoutFormData>({
    resolver: zodResolver(createWorkoutSchema(t)),
    defaultValues: {
      id: workoutToEdit?.id || undefined,
      name: workoutToEdit?.name || "",
      activityId: workoutToEdit?.exercises[0]?.activityId || 0,
      duration: workoutToEdit?.duration || "",
      exerciseIds: workoutToEdit?.exercises?.map((ex) => ex.id) || [],
    },
  });
  const { data: workoutExercices } = useGetWorkoutsExercices();
  const { mutate: upsertWorkout } = useUpsertWorkout();

  useEffect(() => {
    if (workoutToEdit) {
      form.reset({
        id: workoutToEdit.id || undefined,
        name: workoutToEdit.name || "",
        activityId: workoutToEdit.exercises[0]?.activityId || 0,
        duration: workoutToEdit.duration || "",
        exerciseIds: workoutToEdit.exercises?.map((ex) => ex.id) || [],
      });
    }
  }, [workoutToEdit, form]);

  const { watch, getValues, setValue, control, handleSubmit } = form;

  const possibleActivities = useMemo(() => {
    return (workoutExercices ?? [])
      .map((exercise) => exercise.activity)
      .filter(Boolean)
      .filter((activity, index, self) => index === self.findIndex((a) => a.id === activity.id));
  }, [workoutExercices]);

  const selectedActivityId = watch("activityId");
  const selectedExerciseIds = watch("exerciseIds");

  const filteredExercices = useMemo(() => {
    return (workoutExercices ?? []).filter(
      (exercise) => exercise.activityId === selectedActivityId,
    );
  }, [workoutExercices, selectedActivityId]);

  const selectedExercises = useMemo(() => {
    return filteredExercices.filter((exercise) => selectedExerciseIds.includes(exercise.id));
  }, [filteredExercices, selectedExerciseIds]);

  const onSubmit = (data: WorkoutFormData) => {
    upsertWorkout(data);
    setIsOpen(false);
  };

  const toggleExercise = (exerciseId: number) => {
    const currentIds = getValues("exerciseIds");
    if (currentIds.includes(exerciseId)) {
      setValue(
        "exerciseIds",
        currentIds.filter((id) => id !== exerciseId),
      );
    } else {
      setValue("exerciseIds", [...currentIds, exerciseId]);
    }
  };

  const handleActivityChange = (activityId: string) => {
    const activityIdNumber = Number.parseInt(activityId);
    setValue("activityId", activityIdNumber);
    // Réinitialiser la sélection d'exercices quand l'activité change
    setValue("exerciseIds", []);
  };

  const removeExercise = (exerciseId: number) => {
    const currentIds = getValues("exerciseIds");
    setValue(
      "exerciseIds",
      currentIds.filter((id) => id !== exerciseId),
    );
  };

  return (
    <div className="h-[75vh] bg-background p-4">
      <div className="max-w-2xl mx-auto h-full flex flex-col">
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
            <div className="space-y-6 flex-1">
              <InputRhf
                control={control}
                name="name"
                label={t("session.name")}
                placeholder={t("session.namePlaceholder")}
              />
              <NumberInputRhf
                control={control}
                name="duration"
                label={t("session.duration")}
                placeholder={t("session.durationPlaceholder")}
                min={0}
              />

              <FormField
                control={control}
                name="activityId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("session.sport")}</FormLabel>
                    <Select onValueChange={handleActivityChange} value={field.value.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("session.sportPlaceholder")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-background-dark-blue text-base font-medium border-white/20">
                        {possibleActivities.map((activity) => (
                          <SelectItem key={activity.id} value={activity.id.toString()}>
                            {getLocalizedName(activity, currentLanguage)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="exerciseIds"
                render={() => (
                  <FormItem>
                    <FormLabel>{t("session.exercises")}</FormLabel>
                    <Popover open={open} onOpenChange={setOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={open}
                            disabled={!selectedActivityId || selectedActivityId === 0}
                            className="w-full justify-between min-h-[2.5rem] h-auto"
                          >
                            {!selectedActivityId || selectedActivityId === 0 ? (
                              t("exercise.selectFirst")
                            ) : selectedExercises.length === 0 ? (
                              t("exercise.selectExercises")
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {selectedExercises.map((exercise) => (
                                  <Badge
                                    key={exercise.id}
                                    variant="secondary"
                                    className="flex items-center gap-1 bg-main-gray cursor-pointer"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      removeExercise(exercise.id);
                                    }}
                                  >
                                    {getLocalizedName(exercise, currentLanguage)}
                                    <X className="h-3 w-3" />
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[var(--radix-popover-trigger-width)] p-0"
                        align="start"
                      >
                        <Command className="rounded-md border shadow-md bg-primary">
                          <CommandInput placeholder={t("exercise.searchPlaceholder")} />
                          <CommandList>
                            <CommandEmpty>{t("exercise.noneFound")}</CommandEmpty>
                            <CommandGroup>
                              {filteredExercices?.map((exercise) => (
                                <CommandItem
                                  key={exercise.id}
                                  onSelect={() => {
                                    toggleExercise(exercise.id);
                                  }}
                                  className="cursor-pointer"
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${
                                      selectedExerciseIds.includes(exercise.id)
                                        ? "opacity-100"
                                        : "opacity-0"
                                    }`}
                                  />
                                  {getLocalizedName(exercise, currentLanguage)}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="mt-auto pt-6">
              <Button
                type="submit"
                className="w-full bg-white hover:bg-white/90 text-primary"
                size="lg"
              >
                {workoutToEdit ? t("session.updateSession") : t("session.saveSession")}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default UpsertWorkoutSession;
