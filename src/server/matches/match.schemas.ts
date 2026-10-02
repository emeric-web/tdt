import { z } from "zod";
import { scoreSchema } from "@/server/score/score.validator";

export const scheduleMatchSchema = z.strictObject({
  scheduledAt: z.iso.datetime({ offset: true }),
  court: z.string().trim().min(1).max(100),
});

export const declareResultSchema = z.strictObject({
  winnerId: z.string().min(1),
  score: scoreSchema,
});

export type ScheduleMatchInput = z.infer<typeof scheduleMatchSchema>;
export type DeclareResultInput = z.infer<typeof declareResultSchema>;
