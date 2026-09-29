import { z } from "zod";

export const createTournamentSchema = z.object({
  name: z.string().trim().min(3).max(80),
  startDate: z.iso.datetime({ offset: true }).optional(),
  finalSetSuperTiebreak: z.boolean(),
});

export const addParticipantSchema = z.object({
  userId: z.string().min(1),
  seed: z.number().int().positive().optional(),
});
