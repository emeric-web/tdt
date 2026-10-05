import { describe, expect, it } from "vitest";

import {
  arbitrateResultSchema,
  arbitrateScoreSchema,
  contestScoreSchema,
  declareResultSchema,
  proposeCorrectionSchema,
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

describe("proposeCorrectionSchema", () => {
  it("requires a winner and a complete score shape", () => {
    expect(
      proposeCorrectionSchema.safeParse({
        winnerId: "player-2",
        score: [
          { p1: 4, p2: 6 },
          { p1: 6, p2: 3 },
          { p1: 4, p2: 6 },
        ],
      }).success,
    ).toBe(true);
    expect(
      proposeCorrectionSchema.safeParse({
        winnerId: "player-2",
        score: [{ p1: 6, p2: 4 }],
      }).success,
    ).toBe(false);
  });

  describe("arbitrateResultSchema", () => {
    it("accepts a normal decision with a complete score", () => {
      expect(
        arbitrateResultSchema.safeParse({
          winnerId: "player-1",
          score: [
            { p1: 6, p2: 4 },
            { p1: 6, p2: 3 },
          ],
          resultKind: "NORMAL",
        }).success,
      ).toBe(true);
    });

    it("requires a reason for abandonment and forfeit and an empty forfeit score", () => {
      expect(
        arbitrateResultSchema.safeParse({
          winnerId: "player-1",
          score: [{ p1: 3, p2: 1 }],
          resultKind: "ABANDON",
        }).success,
      ).toBe(false);
      expect(
        arbitrateResultSchema.safeParse({
          winnerId: "player-1",
          score: [{ p1: 6, p2: 4 }],
          resultKind: "FORFEIT",
          reason: "Absence",
        }).success,
      ).toBe(false);
      expect(
        arbitrateResultSchema.safeParse({
          winnerId: "player-1",
          score: [],
          resultKind: "FORFEIT",
          reason: "Absence",
        }).success,
      ).toBe(true);
    });
  });

  describe("arbitrateScoreSchema", () => {
    it("defaults to a normal score decision and requires a reason for abandonment", () => {
      expect(
        arbitrateScoreSchema.parse({
          score: [
            { p1: 6, p2: 4 },
            { p1: 6, p2: 3 },
          ],
        }).resultKind,
      ).toBe("NORMAL");
      expect(
        arbitrateScoreSchema.safeParse({
          score: [{ p1: 4, p2: 2 }],
          resultKind: "ABANDON",
        }).success,
      ).toBe(false);
    });
  });

  describe("contestScoreSchema", () => {
    it("accepts a score and rejects winner fields or malformed scores", () => {
      expect(
        contestScoreSchema.safeParse({
          score: [
            { p1: 4, p2: 6 },
            { p1: 6, p2: 3 },
            { p1: 4, p2: 6 },
          ],
        }).success,
      ).toBe(true);
      expect(
        contestScoreSchema.safeParse({
          winnerId: "player-1",
          score: [
            { p1: 4, p2: 6 },
            { p1: 6, p2: 3 },
          ],
        }).success,
      ).toBe(false);
      expect(
        contestScoreSchema.safeParse({ score: [{ p1: 6, p2: 4 }] }).success,
      ).toBe(false);
    });
  });
});
