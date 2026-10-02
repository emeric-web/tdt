import { describe, expect, it } from "vitest";

import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
} from "@/server/errors/app-error";
import {
  guardDeclaredWinner,
  guardMatchDeclaration,
  guardMatchScheduling,
} from "@/server/matches/match.rules";

describe("guardMatchScheduling", () => {
  it("allows pending non-bye matches", () => {
    expect(() => guardMatchScheduling("PENDING", false)).not.toThrow();
  });

  describe("guardMatchDeclaration", () => {
    const activeMatch = () =>
      guardMatchDeclaration(
        "PENDING",
        false,
        "IN_PROGRESS",
        "player-1",
        "player-2",
        "player-1",
      );

    it("allows a player to declare a pending match in an active tournament", () => {
      expect(activeMatch).not.toThrow();
    });

    it("rejects users who are not players in the match", () => {
      expect(() =>
        guardMatchDeclaration(
          "PENDING",
          false,
          "IN_PROGRESS",
          "player-1",
          "player-2",
          "other-user",
        ),
      ).toThrow(ForbiddenError);
    });

    it.each([
      ["PENDING", true, "IN_PROGRESS"],
      ["DECLARED", false, "IN_PROGRESS"],
      ["CORRECTION_PROPOSED", false, "IN_PROGRESS"],
      ["DISPUTED", false, "IN_PROGRESS"],
      ["VALIDATED", false, "IN_PROGRESS"],
      ["PENDING", false, "DRAFT"],
      ["PENDING", false, "FINISHED"],
    ] as const)(
      "rejects an unavailable match or tournament (%s, bye=%s, %s)",
      (status, isBye, tournamentStatus) => {
        expect(() =>
          guardMatchDeclaration(
            status,
            isBye,
            tournamentStatus,
            "player-1",
            "player-2",
            "player-1",
          ),
        ).toThrow(ConflictError);
      },
    );
  });

  it("rejects bye matches", () => {
    expect(() => guardMatchScheduling("PENDING", true)).toThrow(ConflictError);
  });

  it.each([
    "DECLARED",
    "CORRECTION_PROPOSED",
    "DISPUTED",
    "VALIDATED",
  ] as const)("rejects a match with status %s", (status) => {
    expect(() => guardMatchScheduling(status, false)).toThrow(ConflictError);
  });

  it("accepts a winner who matches the validated score", () => {
    expect(() =>
      guardDeclaredWinner("player-2", "player-2", "player-1", "player-2"),
    ).not.toThrow();
  });

  it("rejects a winner who is not part of the match", () => {
    expect(() =>
      guardDeclaredWinner("other-user", "other-user", "player-1", "player-2"),
    ).toThrow(BadRequestError);
  });

  it("rejects a selected winner that contradicts the score", () => {
    expect(() =>
      guardDeclaredWinner("player-1", "player-2", "player-1", "player-2"),
    ).toThrow("Le vainqueur indiqué ne correspond pas au score.");
  });
});
