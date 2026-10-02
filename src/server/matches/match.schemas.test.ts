import { describe, expect, it } from "vitest";

import { scheduleMatchSchema } from "@/server/matches/match.schemas";

describe("scheduleMatchSchema", () => {
  it("accepts an ISO datetime with a non-empty trimmed court", () => {
    expect(
      scheduleMatchSchema.parse({
        scheduledAt: "2026-10-02T14:30:00+02:00",
        court: "  Court 1  ",
      }),
    ).toEqual({
      scheduledAt: "2026-10-02T14:30:00+02:00",
      court: "Court 1",
    });
  });

  it.each([
    { scheduledAt: "tomorrow", court: "Court 1" },
    { scheduledAt: "2026-10-02T14:30:00+02:00", court: " " },
    { scheduledAt: "2026-10-02T14:30:00+02:00", court: "C".repeat(101) },
    {
      scheduledAt: "2026-10-02T14:30:00+02:00",
      court: "Court 1",
      extra: true,
    },
  ])("rejects invalid schedule input %#", (input) => {
    expect(scheduleMatchSchema.safeParse(input).success).toBe(false);
  });
});
