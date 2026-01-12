import { Plus, Trash2, Clock } from "lucide-react";
import { FormControl, FormField, FormItem, FormLabel } from "../../../../components/ui/form";
import { useTranslation } from "react-i18next";
import { Button } from "../../../../components/ui/button";
import { EXERCISE_TYPE } from "../../../../types/workout.types";
import { Card } from "../../../../components/ui/card";
import { Input } from "../../../../components/ui/input";
import { NumberInputRhf } from "../../../../components/forms/number_input_rhf";
import type { WorkoutSessionData } from "../../schemas/workout_schema";
import { useFormContext } from "react-hook-form";
import { getSetsDefaultValues } from "../../utils/get_default_values";

const ExercisesConfiguration = () => {
  const { t } = useTranslation("workout");
  const { getValues, setValue, control, watch } = useFormContext<WorkoutSessionData>();

  const exercises = watch("exercises");

  const addSet = (exerciseIndex: number) => {
    const exercise = getValues(`exercises.${exerciseIndex}`);
    const defaultValues: WorkoutSessionData["exercises"][number]["sets"][number] = {
      ...getSetsDefaultValues(exercise.type),
      order: exercise.sets.length + 1,
    };
    setValue(`exercises.${exerciseIndex}.sets`, [...exercise.sets, { ...defaultValues }]);
  };

  const removeSet = (exerciseIndex: number, setIndex: number) => {
    const currentSets = getValues(`exercises.${exerciseIndex}.sets`);
    if (currentSets.length > 1) {
      const updatedSets = currentSets.filter((_, index) => index !== setIndex);
      setValue(`exercises.${exerciseIndex}.sets`, updatedSets);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{t("exercise.configuration")}</h3>
      {exercises.map((exercise, exerciseIndex) => {
        const exerciseSets = exercise.sets || [];

        return (
          <Card key={exercise.id} className="p-4 bg-primary">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">
                {exerciseIndex + 1} - {exercise.name}
              </h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addSet(exerciseIndex)}
              >
                <Plus className="h-4 w-4 mr-1" />
                {t("exercise.addSeries")}
              </Button>
            </div>

            <div className="space-y-3">
              {exerciseSets.map((_, setIndex) => (
                <div key={setIndex} className="flex items-center gap-4 p-3">
                  <span className="text-sm font-medium text-muted-foreground min-w-[60px]">
                    {t("exercise.series")} {setIndex + 1}
                  </span>
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    {(exercise.type === EXERCISE_TYPE.BODYWEIGHT_REPS ||
                      exercise.type === EXERCISE_TYPE.WEIGHTED_REPS) && (
                      <NumberInputRhf
                        control={control}
                        name={`exercises.${exerciseIndex}.sets.${setIndex}.reps`}
                        label={t("exercise.reps")}
                      />
                    )}
                    {(exercise.type === EXERCISE_TYPE.WEIGHTED_REPS ||
                      exercise.type === EXERCISE_TYPE.WEIGHTED_TIME) && (
                      <NumberInputRhf
                        control={control}
                        name={`exercises.${exerciseIndex}.sets.${setIndex}.weight`}
                        label={t("exercise.weight")}
                        step="0.5"
                      />
                    )}
                    {(exercise.type === EXERCISE_TYPE.BODYWEIGHT_TIME ||
                      exercise.type === EXERCISE_TYPE.WEIGHTED_TIME) && (
                      <FormField
                        control={control}
                        name={`exercises.${exerciseIndex}.sets.${setIndex}.duration`}
                        render={({ field }) => (
                          <FormItem className="flex flex-col gap-y-2">
                            <FormLabel className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              {t("exercise.time")}
                            </FormLabel>
                            <FormControl>
                              <Input type="time" step="1" {...field} className="w-full" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                  {exerciseSets.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeSet(exerciseIndex, setIndex)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default ExercisesConfiguration;
