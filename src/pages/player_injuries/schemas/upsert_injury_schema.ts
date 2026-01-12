import { z } from "zod";

export const upsertInjurySchema = z.object({
  id: z.number().optional(),
  athleteId: z.coerce.number(),
  injuryTypeId: z.coerce.number(),
  startDate: z.date(),
  endDate: z.date().optional(),
  context: z.union([z.enum(["match", "training", "other"]), z.literal("")]).optional(),
  note: z.string().optional(),
});

export type UpsertInjurySchema = z.infer<typeof upsertInjurySchema>;

export const upsertInjuryDefaultValues: UpsertInjurySchema = {
  athleteId: 190,
  injuryTypeId: 145,
  startDate: new Date(),
  endDate: undefined,
};
