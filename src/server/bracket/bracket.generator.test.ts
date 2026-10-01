import { describe, expect, it } from "vitest";

import { BadRequestError } from "@/server/errors/app-error";
import {
  computeBracketSize,
  computeRoundCount,
  generateFirstRoundMatches,
  type BracketParticipant,
} from "@/server/bracket/bracket.generator";

describe("computeBracketSize", () => {
  it.each([
    [1, 1],
    [2, 2],
    [3, 4],
    [4, 4],
    [5, 8],
    [11, 16],
    [16, 16],
    [17, 32],
  ])("returns %i -> %i", (participantCount, expected) => {
    expect(computeBracketSize(participantCount)).toBe(expected);
  });
});

describe("computeRoundCount", () => {
  it.each([
    [1, 0],
    [2, 1],
    [4, 2],
    [8, 3],
    [16, 4],
    [32, 5],
  ])("returns %i -> %i", (bracketSize, expected) => {
    expect(computeRoundCount(bracketSize)).toBe(expected);
  });
});

describe("generateFirstRoundMatches", () => {
  it("rejects a draw with fewer than two participants", () => {
    expect(() => generateFirstRoundMatches([{ id: "p1", seed: null }])).toThrow(
      BadRequestError,
    );
  });

  it("pairs a fully seeded draw following the standard bracket order", () => {
    const participants: BracketParticipant[] = [
      { id: "p1", seed: 1 },
      { id: "p2", seed: 2 },
      { id: "p3", seed: 3 },
      { id: "p4", seed: 4 },
    ];

    const matches = generateFirstRoundMatches(participants);

    expect(matches).toEqual([
      { position: 0, player1Id: "p1", player2Id: "p4", isBye: false },
      { position: 1, player1Id: "p2", player2Id: "p3", isBye: false },
    ]);
  });

  it("builds a 16-slot bracket with 5 byes for 11 participants", () => {
    const participants: BracketParticipant[] = [
      { id: "seed1", seed: 1 },
      { id: "seed2", seed: 2 },
      { id: "seed3", seed: 3 },
      { id: "p4", seed: null },
      { id: "p5", seed: null },
      { id: "p6", seed: null },
      { id: "p7", seed: null },
      { id: "p8", seed: null },
      { id: "p9", seed: null },
      { id: "p10", seed: null },
      { id: "p11", seed: null },
    ];

    const matches = generateFirstRoundMatches(participants);

    expect(matches).toHaveLength(8);

    const byes = matches.filter((match) => match.isBye);
    expect(byes).toHaveLength(5);

    const seededIds = new Set(["seed1", "seed2", "seed3"]);
    const byeSurvivors = byes.map(
      (match) => match.player1Id ?? match.player2Id,
    );
    const seededByeCount = byeSurvivors.filter((id) =>
      seededIds.has(id ?? ""),
    ).length;

    // Byes go first to the seeds: with 3 seeds and 5 byes, every seed is exempt.
    expect(seededByeCount).toBe(3);

    // No match leaves both slots empty, and every participant appears exactly once.
    const placedIds = matches.flatMap((match) =>
      [match.player1Id, match.player2Id].filter(
        (id): id is string => id !== null,
      ),
    );
    expect(placedIds.sort()).toEqual(
      participants.map((participant) => participant.id).sort(),
    );
  });

  it("never leaves both slots of the same match empty", () => {
    const participants: BracketParticipant[] = Array.from(
      { length: 5 },
      (_, index) => ({ id: `p${index + 1}`, seed: null }),
    );

    const matches = generateFirstRoundMatches(participants);

    for (const match of matches) {
      expect(match.player1Id !== null || match.player2Id !== null).toBe(true);
    }
  });

  it("uses the injected random source to shuffle unseeded participants", () => {
    const participants: BracketParticipant[] = Array.from(
      { length: 4 },
      (_, index) => ({ id: `p${index + 1}`, seed: null }),
    );

    const identityRandom = () => 0;
    const matches = generateFirstRoundMatches(participants, identityRandom);

    const placedIds = matches.flatMap((match) =>
      [match.player1Id, match.player2Id].filter(
        (id): id is string => id !== null,
      ),
    );
    expect(placedIds.sort()).toEqual(["p1", "p2", "p3", "p4"]);
  });
});
