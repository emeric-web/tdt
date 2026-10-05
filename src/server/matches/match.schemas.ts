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

const administrativeScoreSchema = z
  .array(
    z.strictObject({
      p1: z.number().int().nonnegative(),
      p2: z.number().int().nonnegative(),
      tb: z.number().int().nonnegative().optional(),
    }),
  )
  .max(3);

const resultKindSchema = z.enum(["NORMAL", "ABANDON", "FORFEIT"]);
const scoreResultKindSchema = z.enum(["NORMAL", "ABANDON"]);
const reasonSchema = z.string().trim().min(1).max(500);

export const arbitrateResultSchema = z
  .strictObject({
    winnerId: z.string().min(1),
    score: administrativeScoreSchema,
    resultKind: resultKindSchema,
    reason: reasonSchema.optional(),
  })
  .superRefine((value, context) => {
    if (
      (value.resultKind === "ABANDON" || value.resultKind === "FORFEIT") &&
      !value.reason
    ) {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Un motif est obligatoire pour un abandon ou un forfait.",
      });
    }
    if (value.resultKind === "FORFEIT" && value.score.length !== 0) {
      context.addIssue({
        code: "custom",
        path: ["score"],
        message: "Un forfait ne peut pas comporter de score sportif.",
      });
    }
    if (value.resultKind === "ABANDON" && value.score.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["score"],
        message: "Un abandon doit conserver les scores réellement joués.",
      });
    }
  });

export const arbitrateScoreSchema = z
  .strictObject({
    score: administrativeScoreSchema,
    resultKind: scoreResultKindSchema.default("NORMAL"),
    reason: reasonSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.resultKind === "ABANDON" && !value.reason) {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Un motif est obligatoire pour un abandon.",
      });
    }
    if (value.resultKind === "ABANDON" && value.score.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["score"],
        message: "Un abandon doit conserver les scores réellement joués.",
      });
    }
  });

export type ScheduleMatchInput = z.infer<typeof scheduleMatchSchema>;
export type DeclareResultInput = z.infer<typeof declareResultSchema>;
export type ProposeCorrectionInput = z.infer<typeof proposeCorrectionSchema>;
export type ContestScoreInput = z.infer<typeof contestScoreSchema>;
export type ArbitrateResultInput = z.infer<typeof arbitrateResultSchema>;
export type ArbitrateScoreInput = z.infer<typeof arbitrateScoreSchema>;
