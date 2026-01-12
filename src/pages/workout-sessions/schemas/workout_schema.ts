import { z } from "zod";
import { EXERCISE_TYPE } from "../../../types/workout.types";
import type { TFunction } from "i18next";

export const createWorkoutSchema = (t: TFunction<"workout">) =>
  z.object({
    id: z.number().optional(),
    name: z.string().min(1, t("validation.sessionNameRequired")),
    activityId: z.number().min(1, t("validation.sportRequired")),
    exerciseIds: z.array(z.number()).min(1, t("validation.exerciseRequired")),
    duration: z
      .union([z.literal(""), z.number()])
      .refine((val) => val !== "" && typeof val === "number" && val >= 1, {
        message: t("validation.durationRequired"),
      }),
  });

export type WorkoutFormData = z.infer<ReturnType<typeof createWorkoutSchema>>;

export const createWorkoutSessionSchema = (t: TFunction<"workout">) =>
  z.object({
    exercises: z.array(
      z
        .object({
          id: z.number(),
          name: z.string(),
          type: z.nativeEnum(EXERCISE_TYPE),
          sets: z
            .array(
              z.object({
                order: z.number(),
                reps: z.union([z.literal(""), z.number()]).optional(),
                weight: z.union([z.literal(""), z.number()]).optional(),
                duration: z.string().optional(),
              }),
            )
            .min(1),
        })
        .superRefine((exercise, ctx) => {
          const exerciseType = exercise.type;

          exercise.sets.forEach((set, setIndex) => {
            // WEIGHTED_REPS: nécessite reps et weight, pas de duration
            if (exerciseType === EXERCISE_TYPE.WEIGHTED_REPS) {
              if (set.reps === "" || typeof set.reps !== "number" || set.reps < 1) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: t("validation.repsRequired"),
                  path: ["sets", setIndex, "reps"],
                });
              }
              if (set.weight === "" || typeof set.weight !== "number" || set.weight < 1) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: t("validation.weightRequired"),
                  path: ["sets", setIndex, "weight"],
                });
              }
            }

            // WEIGHTED_TIME: nécessite weight et duration, pas de reps
            if (exerciseType === EXERCISE_TYPE.WEIGHTED_TIME) {
              if (set.weight === "" || typeof set.weight !== "number" || set.weight < 1) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: t("validation.weightRequired"),
                  path: ["sets", setIndex, "weight"],
                });
              }
              if (
                !set.duration ||
                set.duration === "" ||
                !/^[0-9]+:[0-9]+:[0-9]+$/.test(set.duration)
              ) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: t("validation.durationFormat"),
                  path: ["sets", setIndex, "duration"],
                });
              }
            }

            // BODYWEIGHT_REPS: nécessite reps, pas de weight ni duration
            if (exerciseType === EXERCISE_TYPE.BODYWEIGHT_REPS) {
              if (set.reps === "" || typeof set.reps !== "number" || set.reps < 1) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: t("validation.repsRequired"),
                  path: ["sets", setIndex, "reps"],
                });
              }
            }

            // BODYWEIGHT_TIME: nécessite duration, pas de reps ni weight
            if (exerciseType === EXERCISE_TYPE.BODYWEIGHT_TIME) {
              if (
                !set.duration ||
                set.duration === "" ||
                !/^[0-9]+:[0-9]+:[0-9]+$/.test(set.duration)
              ) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: t("validation.durationFormat"),
                  path: ["sets", setIndex, "duration"],
                });
              }
            }
          });
        }),
    ),
    players: z.array(z.number()).min(1, t("validation.playerRequired")),
    date: z.date({
      required_error: t("validation.dateRequired"),
    }),
    time: z.string().min(1, t("validation.timeRequired")),
  });

export type WorkoutSessionData = z.infer<ReturnType<typeof createWorkoutSessionSchema>>;
