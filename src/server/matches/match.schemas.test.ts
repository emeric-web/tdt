import { describe, expect, it } from "vitest";

import {
  declareResultSchema,
  scheduleMatchSchema,
} from "@/server/matches/match.schemas";

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

describe("declareResultSchema", () => {
  it("accepts a winner and a two-set score", () => {
    expect(
      declareResultSchema.parse({
        winnerId: "player-1",
        score: [
          { p1: 6, p2: 4 },
          { p1: 6, p2: 3 },
        ],
      }),
    ).toEqual({
      winnerId: "player-1",
      score: [
        { p1: 6, p2: 4 },
        { p1: 6, p2: 3 },
      ],
    });
  });

  it("rejects empty winner ids and extra properties", () => {
    expect(
      declareResultSchema.safeParse({
        winnerId: "",
        score: [
          { p1: 6, p2: 4 },
          { p1: 6, p2: 3 },
        ],
      }).success,
    ).toBe(false);
    expect(
      declareResultSchema.safeParse({
        winnerId: "player-1",
        score: [
          { p1: 6, p2: 4 },
          { p1: 6, p2: 3 },
        ],
        extra: true,
      }).success,
    ).toBe(false);
  });
});
