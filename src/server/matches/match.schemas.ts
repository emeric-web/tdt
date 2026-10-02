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

export const proposeCorrectionSchema = declareResultSchema;

export const contestScoreSchema = z.strictObject({
  score: scoreSchema,
});

export type ScheduleMatchInput = z.infer<typeof scheduleMatchSchema>;
export type DeclareResultInput = z.infer<typeof declareResultSchema>;
export type ProposeCorrectionInput = z.infer<typeof proposeCorrectionSchema>;
export type ContestScoreInput = z.infer<typeof contestScoreSchema>;
