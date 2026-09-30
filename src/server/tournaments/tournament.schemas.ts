import { z } from "zod";

export const createTournamentSchema = z.strictObject({
  name: z.string().trim().min(3).max(80),
  startDate: z.iso.datetime({ offset: true }).optional(),
  finalSetSuperTiebreak: z.boolean(),
});

export const listTournamentsSchema = z.strictObject({
  status: z.enum(["DRAFT", "IN_PROGRESS", "FINISHED"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const addParticipantSchema = z.object({
  userId: z.string().min(1),
  seed: z.number().int().positive().optional(),
});

export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;
export type ListTournamentsInput = z.infer<typeof listTournamentsSchema>;
