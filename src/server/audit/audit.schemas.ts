import { z } from "zod";

export const listAuditSchema = z.strictObject({
  tournamentId: z.string().min(1),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListAuditInput = z.infer<typeof listAuditSchema>;
