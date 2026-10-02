import { z } from "zod";

export const scheduleMatchSchema = z.strictObject({
  scheduledAt: z.iso.datetime({ offset: true }),
  court: z.string().trim().min(1).max(100),
});

export type ScheduleMatchInput = z.infer<typeof scheduleMatchSchema>;
