import { describe, expect, it } from "vitest";

import {
  addParticipantSchema,
  createTournamentSchema,
} from "@/server/tournaments/tournament.schemas";

describe("tournament schemas", () => {
  it("normalizes a valid tournament name", () => {
    expect(
      createTournamentSchema.parse({
        name: "  Open TdT  ",
        finalSetSuperTiebreak: false,
      }),
    ).toEqual({
      name: "Open TdT",
      finalSetSuperTiebreak: false,
    });
  });

  it("rejects tournament names outside the allowed length", () => {
    expect(
      createTournamentSchema.safeParse({
        name: "x",
        finalSetSuperTiebreak: false,
      }).success,
    ).toBe(false);

    expect(
      createTournamentSchema.safeParse({
        name: "x".repeat(81),
        finalSetSuperTiebreak: false,
      }).success,
    ).toBe(false);
  });

  it("requires a positive integer seed when one is provided", () => {
    expect(addParticipantSchema.parse({ userId: "user-1", seed: 2 })).toEqual({
      userId: "user-1",
      seed: 2,
    });

    expect(
      addParticipantSchema.safeParse({ userId: "user-1", seed: 0 }).success,
    ).toBe(false);
    expect(
      addParticipantSchema.safeParse({ userId: "user-1", seed: 1.5 }).success,
    ).toBe(false);
  });
});
