import { describe, expect, it } from "vitest";

import { groupByRound, roundLabel } from "./bracket";
import type { MatchDto } from "@/types/bracket";

function match(overrides: Partial<MatchDto>): MatchDto {
  return {
    id: "m1",
    round: 1,
    position: 0,
    player1: null,
    player2: null,
    status: "PENDING",
    scoreStatus: "NONE",
    winnerId: null,
    declaredById: null,
    score: null,
    proposedScore: null,
    isBye: false,
    scheduledAt: null,
    court: null,
    ...overrides,
  };
}

describe("groupByRound", () => {
  it("groups matches by round and sorts rounds and positions", () => {
    const matches = [
      match({ id: "r2-p1", round: 2, position: 1 }),
      match({ id: "r1-p1", round: 1, position: 1 }),
      match({ id: "r1-p0", round: 1, position: 0 }),
      match({ id: "r2-p0", round: 2, position: 0 }),
    ];

    expect(groupByRound(matches)).toEqual([
      {
        round: 1,
        matches: [
          expect.objectContaining({ id: "r1-p0" }),
          expect.objectContaining({ id: "r1-p1" }),
        ],
      },
      {
        round: 2,
        matches: [
          expect.objectContaining({ id: "r2-p0" }),
          expect.objectContaining({ id: "r2-p1" }),
        ],
      },
    ]);
  });

  it("returns an empty list when there is no match", () => {
    expect(groupByRound([])).toEqual([]);
  });
});

describe("roundLabel", () => {
  it("labels the final round as Finale", () => {
    expect(roundLabel(3, 3)).toBe("Finale");
  });

  it("labels the round before the final as Demi-finales", () => {
    expect(roundLabel(2, 3)).toBe("Demi-finales");
  });

  it("labels the first round of a 4-round bracket as Huitièmes de finale", () => {
    expect(roundLabel(1, 4)).toBe("Huitièmes de finale");
  });

  it("falls back to a generic label beyond the known rounds", () => {
    expect(roundLabel(1, 5)).toBe("Tour 1");
  });
});
