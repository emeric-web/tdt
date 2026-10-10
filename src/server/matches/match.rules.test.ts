import { describe, expect, it } from "vitest";

import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
} from "@/server/errors/app-error";
import {
  guardDeclaredWinner,
  guardMatchConfirmation,
  guardMatchArbitration,
  guardMatchCorrectionProposal,
  guardMatchDeclaration,
  guardMatchScoreContest,
  guardMatchScheduling,
  guardValidatedResultCorrection,
} from "@/server/matches/match.rules";

describe("guardMatchScheduling", () => {
  it("allows pending non-bye matches", () => {
    expect(() => guardMatchScheduling("PENDING", false)).not.toThrow();
  });

  describe("guardMatchArbitration", () => {
    it("allows an active non-bye match with both players", () => {
      expect(() =>
        guardMatchArbitration(
          "CORRECTION_PROPOSED",
          "CORRECTION_PROPOSED",
          false,
          "IN_PROGRESS",
          "player-1",
          "player-2",
        ),
      ).not.toThrow();
    });

    describe("guardValidatedResultCorrection", () => {
      it("allows correcting a validated match in an active tournament", () => {
        expect(() =>
          guardValidatedResultCorrection(
            "VALIDATED",
            "VALIDATED",
            false,
            "IN_PROGRESS",
            "player-1",
            "player-1",
            "player-2",
          ),
        ).not.toThrow();
      });

      it.each([
        ["PENDING", "NONE", false, "IN_PROGRESS"],
        ["DECLARED", "DECLARED", false, "IN_PROGRESS"],
        ["VALIDATED", "VALIDATED", true, "IN_PROGRESS"],
        ["VALIDATED", "VALIDATED", false, "FINISHED"],
        ["VALIDATED", "CORRECTION_PROPOSED", false, "IN_PROGRESS"],
      ] as const)(
        "rejects a non-correctable match state (%s, %s, bye=%s, %s)",
        (status, scoreStatus, isBye, tournamentStatus) => {
          expect(() =>
            guardValidatedResultCorrection(
              status,
              scoreStatus,
              isBye,
              tournamentStatus,
              "player-1",
              "player-1",
              "player-2",
            ),
          ).toThrow(ConflictError);
        },
      );
    });

    it.each([
      ["PENDING", false, "IN_PROGRESS", "player-1", "player-2"],
      ["VALIDATED", false, "IN_PROGRESS", "player-1", "player-2"],
      ["DECLARED", true, "IN_PROGRESS", "player-1", "player-2"],
      ["DISPUTED", false, "FINISHED", "player-1", "player-2"],
      ["DECLARED", false, "IN_PROGRESS", null, "player-2"],
    ] as const)(
      "rejects unavailable arbitration state %#",
      (status, isBye, tournamentStatus, player1Id, player2Id) => {
        expect(() =>
          guardMatchArbitration(
            status,
            status === "PENDING"
              ? "NONE"
              : status === "VALIDATED"
                ? "VALIDATED"
                : status,
            isBye,
            tournamentStatus,
            player1Id,
            player2Id,
          ),
        ).toThrow(ConflictError);
      },
    );

    it("rejects inconsistent result and score statuses", () => {
      expect(() =>
        guardMatchArbitration(
          "CORRECTION_PROPOSED",
          "DECLARED",
          false,
          "IN_PROGRESS",
          "player-1",
          "player-2",
        ),
      ).toThrow(ConflictError);
    });
  });

  describe("guardMatchScoreContest", () => {
    it("allows the opponent to contest the score without choosing a winner", () => {
      expect(() =>
        guardMatchScoreContest(
          "DECLARED",
          "DECLARED",
          false,
          "IN_PROGRESS",
          "player-1",
          "player-2",
          "player-1",
          "player-2",
        ),
      ).not.toThrow();
    });

    it("rejects the original declarant", () => {
      expect(() =>
        guardMatchScoreContest(
          "DECLARED",
          "DECLARED",
          false,
          "IN_PROGRESS",
          "player-1",
          "player-2",
          "player-1",
          "player-1",
        ),
      ).toThrow(ForbiddenError);
    });

    it("rejects non-participants", () => {
      expect(() =>
        guardMatchScoreContest(
          "DECLARED",
          "DECLARED",
          false,
          "IN_PROGRESS",
          "player-1",
          "player-2",
          "player-1",
          "other-user",
        ),
      ).toThrow(ForbiddenError);
    });

    it.each([
      ["PENDING", "NONE", false, "IN_PROGRESS"],
      ["CORRECTION_PROPOSED", "CORRECTION_PROPOSED", false, "IN_PROGRESS"],
      ["DECLARED", "DISPUTED", false, "IN_PROGRESS"],
      ["DECLARED", "DECLARED", true, "IN_PROGRESS"],
      ["DECLARED", "DECLARED", false, "DRAFT"],
      ["DECLARED", "DECLARED", false, "FINISHED"],
    ] as const)(
      "rejects unavailable state (%s, %s, bye=%s, %s)",
      (status, scoreStatus, isBye, tournamentStatus) => {
        expect(() =>
          guardMatchScoreContest(
            status,
            scoreStatus,
            isBye,
            tournamentStatus,
            "player-1",
            "player-2",
            "player-1",
            "player-2",
          ),
        ).toThrow(ConflictError);
      },
    );
  });

  describe("guardMatchConfirmation", () => {
    const confirm = (actorId = "player-2") =>
      guardMatchConfirmation(
        "DECLARED",
        "DECLARED",
        false,
        "IN_PROGRESS",
        "player-1",
        "player-2",
        "player-1",
        actorId,
      );

    const confirmCorrection = (actorId = "player-1") =>
      guardMatchConfirmation(
        "CORRECTION_PROPOSED",
        "CORRECTION_PROPOSED",
        false,
        "IN_PROGRESS",
        "player-1",
        "player-2",
        "player-1",
        actorId,
      );

    it("allows the opponent to confirm a declared result", () => {
      expect(confirm).not.toThrow();
    });

    it("allows the original declarant to confirm a proposed correction", () => {
      expect(confirmCorrection).not.toThrow();
    });

    describe("guardMatchCorrectionProposal", () => {
      it("allows the non-declarant to propose the other player as winner", () => {
        expect(() =>
          guardMatchCorrectionProposal(
            "DECLARED",
            "DECLARED",
            false,
            "IN_PROGRESS",
            "player-1",
            "player-2",
            "player-1",
            "player-1",
            "player-2",
            "player-2",
          ),
        ).not.toThrow();
      });

      it("rejects proposals from the original declarant", () => {
        expect(() =>
          guardMatchCorrectionProposal(
            "DECLARED",
            "DECLARED",
            false,
            "IN_PROGRESS",
            "player-1",
            "player-2",
            "player-1",
            "player-1",
            "player-2",
            "player-1",
          ),
        ).toThrow(ForbiddenError);
      });

      it("rejects a proposed winner that is not in the match", () => {
        expect(() =>
          guardMatchCorrectionProposal(
            "DECLARED",
            "DECLARED",
            false,
            "IN_PROGRESS",
            "player-1",
            "player-2",
            "player-1",
            "player-1",
            "other-user",
            "player-2",
          ),
        ).toThrow(BadRequestError);
      });

      it("rejects a proposal that keeps the originally declared winner", () => {
        expect(() =>
          guardMatchCorrectionProposal(
            "DECLARED",
            "DECLARED",
            false,
            "IN_PROGRESS",
            "player-1",
            "player-2",
            "player-1",
            "player-1",
            "player-1",
            "player-2",
          ),
        ).toThrow(BadRequestError);
      });

      it("rejects a correction when the stored initial winner is not a player", () => {
        expect(() =>
          guardMatchCorrectionProposal(
            "DECLARED",
            "DECLARED",
            false,
            "IN_PROGRESS",
            "player-1",
            "player-2",
            "player-1",
            "other-user",
            "player-2",
            "player-2",
          ),
        ).toThrow(ConflictError);
      });

      it.each([
        ["PENDING", "NONE", false, "IN_PROGRESS"],
        ["CORRECTION_PROPOSED", "CORRECTION_PROPOSED", false, "IN_PROGRESS"],
        ["DECLARED", "DISPUTED", false, "IN_PROGRESS"],
        ["DECLARED", "DECLARED", true, "IN_PROGRESS"],
        ["DECLARED", "DECLARED", false, "DRAFT"],
        ["DECLARED", "DECLARED", false, "FINISHED"],
      ] as const)(
        "rejects unavailable state (%s, %s, bye=%s, %s)",
        (status, scoreStatus, isBye, tournamentStatus) => {
          expect(() =>
            guardMatchCorrectionProposal(
              status,
              scoreStatus,
              isBye,
              tournamentStatus,
              "player-1",
              "player-2",
              "player-1",
              "player-1",
              "player-2",
              "player-2",
            ),
          ).toThrow(ConflictError);
        },
      );
    });

    it("rejects confirmation by the player who declared the result", () => {
      expect(() => confirm("player-1")).toThrow(ForbiddenError);
    });

    it("rejects confirmation by a non-participant", () => {
      expect(() => confirm("other-user")).toThrow(ForbiddenError);
    });

    it("rejects correction confirmation by the non-declarant", () => {
      expect(() => confirmCorrection("player-2")).toThrow(ForbiddenError);
    });

    it("rejects a declaration made by someone outside the match", () => {
      expect(() =>
        guardMatchConfirmation(
          "DECLARED",
          "DECLARED",
          false,
          "IN_PROGRESS",
          "player-1",
          "player-2",
          "other-user",
          "player-2",
        ),
      ).toThrow(ConflictError);
    });

    it.each([
      ["PENDING", "NONE", false, "IN_PROGRESS"],
      ["DECLARED", "DISPUTED", false, "IN_PROGRESS"],
      ["VALIDATED", "VALIDATED", false, "IN_PROGRESS"],
      ["DECLARED", "DECLARED", true, "IN_PROGRESS"],
      ["DECLARED", "DECLARED", false, "DRAFT"],
      ["DECLARED", "DECLARED", false, "FINISHED"],
    ] as const)(
      "rejects unavailable match/tournament state (%s, %s, bye=%s, %s)",
      (status, scoreStatus, isBye, tournamentStatus) => {
        expect(() =>
          guardMatchConfirmation(
            status,
            scoreStatus,
            isBye,
            tournamentStatus,
            "player-1",
            "player-2",
            "player-1",
            "player-2",
          ),
        ).toThrow(ConflictError);
      },
    );
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
