import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConflictError } from "@/server/errors/app-error";

const { transaction, $transaction, findMany, findUnique } = vi.hoisted(() => {
  const transaction = {
    match: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    tournament: {
      updateMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };
  return {
    transaction,
    findMany: vi.fn(),
    findUnique: vi.fn(),
    $transaction: vi.fn((callback: (tx: typeof transaction) => unknown) =>
      callback(transaction),
    ),
  };
});

describe("PrismaMatchRepository.contestScore", () => {
  const submittedScore = [
    { p1: 4, p2: 6 },
    { p1: 6, p2: 3 },
    { p1: 4, p2: 6 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    $transaction.mockImplementation((callback) => callback(transaction));
    transaction.match.findUnique.mockResolvedValue({
      id: "match-1",
      status: "DECLARED",
      scoreStatus: "DECLARED",
      isBye: false,
      player1Id: "player-1",
      player2Id: "player-2",
      declaredById: "player-1",
      declaredWinnerId: "player-2",
      version: 5,
      tournament: {
        status: "IN_PROGRESS",
        finalSetSuperTiebreak: false,
      },
    });
    transaction.match.updateMany.mockResolvedValue({ count: 1 });
    transaction.match.findUniqueOrThrow.mockResolvedValue({
      id: "match-1",
      status: "CORRECTION_PROPOSED",
      scoreStatus: "CORRECTION_PROPOSED",
      winnerId: null,
      declaredWinnerId: "player-2",
      proposedWinnerId: "player-2",
      proposedScore: submittedScore,
      score: null,
    });
  });

  describe("PrismaMatchRepository.arbitrate", () => {
    const matchForArbitration = {
      id: "match-1",
      tournamentId: "tournament-1",
      round: 1,
      position: 0,
      status: "CORRECTION_PROPOSED",
      scoreStatus: "CORRECTION_PROPOSED",
      isBye: false,
      player1Id: "player-1",
      player2Id: "player-2",
      winnerId: null,
      declaredById: "player-1",
      declaredWinnerId: "player-2",
      declaredScore: [
        { p1: 4, p2: 6 },
        { p1: 6, p2: 3 },
        { p1: 4, p2: 6 },
      ],
      proposedWinnerId: "player-1",
      proposedScore: [
        { p1: 6, p2: 4 },
        { p1: 6, p2: 3 },
      ],
      score: null,
      resultKind: null,
      version: 7,
      nextMatchId: "next-match",
      nextSlot: 1,
      tournament: {
        status: "IN_PROGRESS",
        finalSetSuperTiebreak: false,
        matches: [{ id: "final-match" }],
      },
    };

    beforeEach(() => {
      vi.clearAllMocks();
      $transaction.mockImplementation((callback) => callback(transaction));
      transaction.match.findUnique.mockResolvedValue(matchForArbitration);
      transaction.match.updateMany.mockResolvedValue({ count: 1 });
      transaction.match.findUniqueOrThrow.mockResolvedValue({
        id: "match-1",
        status: "VALIDATED",
        scoreStatus: "VALIDATED",
        winnerId: "player-1",
        proposedWinnerId: "player-1",
      });
      transaction.auditLog.create.mockResolvedValue({});
    });

    it("validates, advances, and audits an arbitrated result in one transaction", async () => {
      const score = [
        { p1: 6, p2: 4 },
        { p1: 6, p2: 3 },
      ];

      await expect(
        new PrismaMatchRepository().arbitrate("match-1", "admin-1", {
          winnerId: "player-1",
          score,
          resultKind: "NORMAL",
        }),
      ).resolves.toMatchObject({
        id: "match-1",
        status: "VALIDATED",
        scoreStatus: "VALIDATED",
        winnerId: "player-1",
      });

      expect(transaction.match.updateMany).toHaveBeenNthCalledWith(1, {
        where: {
          id: "match-1",
          status: "CORRECTION_PROPOSED",
          scoreStatus: "CORRECTION_PROPOSED",
          version: 7,
          tournament: { status: "IN_PROGRESS" },
        },
        data: {
          winnerId: "player-1",
          score,
          proposedWinnerId: "player-1",
          proposedScore: score,
          resultKind: "NORMAL",
          status: "VALIDATED",
          scoreStatus: "VALIDATED",
          version: { increment: 1 },
        },
      });
      expect(transaction.match.updateMany).toHaveBeenNthCalledWith(2, {
        where: {
          id: "next-match",
          status: "PENDING",
          player1Id: null,
        },
        data: { player1Id: "player-1", version: { increment: 1 } },
      });
      expect(transaction.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tournamentId: "tournament-1",
            actorId: "admin-1",
            action: "ARBITRATE",
            entity: "Match",
            entityId: "match-1",
            before: expect.objectContaining({
              status: "CORRECTION_PROPOSED",
              winnerId: null,
            }),
            after: expect.objectContaining({
              status: "VALIDATED",
              winnerId: "player-1",
            }),
          }),
        }),
      );
    });

    it("closes the tournament when the arbitrated match is the final", async () => {
      transaction.match.findUnique.mockResolvedValue({
        ...matchForArbitration,
        round: 3,
        nextMatchId: null,
        nextSlot: null,
        tournament: {
          ...matchForArbitration.tournament,
          matches: [{ id: "match-1" }],
        },
      });
      transaction.match.findFirst.mockResolvedValue(null);
      transaction.tournament.updateMany.mockResolvedValue({ count: 1 });

      await new PrismaMatchRepository().arbitrate("match-1", "admin-1", {
        winnerId: "player-1",
        score: [
          { p1: 6, p2: 4 },
          { p1: 6, p2: 3 },
        ],
        resultKind: "NORMAL",
      });

      expect(transaction.tournament.updateMany).toHaveBeenCalledWith({
        where: { id: "tournament-1", status: "IN_PROGRESS" },
        data: { status: "FINISHED" },
      });
      expect(transaction.auditLog.create).toHaveBeenCalledOnce();
    });

    it("records a forfeit with no fabricated score and a required reason", async () => {
      await new PrismaMatchRepository().arbitrate("match-1", "admin-1", {
        winnerId: "player-2",
        score: [],
        resultKind: "FORFEIT",
        reason: "L’adversaire ne s’est pas présenté.",
      });

      expect(transaction.match.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            winnerId: "player-2",
            score: [],
            resultKind: "FORFEIT",
          }),
        }),
      );
      expect(transaction.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "ARBITRATE",
            reason: "L’adversaire ne s’est pas présenté.",
          }),
        }),
      );
    });

    it("rejects a decision if another administrator changed the match", async () => {
      transaction.match.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        new PrismaMatchRepository().arbitrate("match-1", "admin-1", {
          winnerId: "player-1",
          score: [
            { p1: 6, p2: 4 },
            { p1: 6, p2: 3 },
          ],
          resultKind: "NORMAL",
        }),
      ).rejects.toThrow(ConflictError);
      expect(transaction.match.updateMany).toHaveBeenCalledTimes(1);
      expect(transaction.auditLog.create).not.toHaveBeenCalled();
    });
  });

  describe("PrismaMatchRepository.arbitrateScore", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      $transaction.mockImplementation((callback) => callback(transaction));
      transaction.match.findUnique.mockResolvedValue({
        id: "match-1",
        tournamentId: "tournament-1",
        round: 1,
        position: 0,
        status: "CORRECTION_PROPOSED",
        scoreStatus: "CORRECTION_PROPOSED",
        isBye: false,
        player1Id: "player-1",
        player2Id: "player-2",
        winnerId: null,
        declaredById: "player-1",
        declaredWinnerId: "player-2",
        declaredScore: [
          { p1: 6, p2: 4 },
          { p1: 6, p2: 3 },
        ],
        proposedWinnerId: "player-2",
        proposedScore: [
          { p1: 6, p2: 4 },
          { p1: 6, p2: 3 },
        ],
        score: null,
        resultKind: null,
        version: 8,
        nextMatchId: "next-match",
        nextSlot: 2,
        tournament: {
          status: "IN_PROGRESS",
          finalSetSuperTiebreak: false,
          matches: [{ id: "final-match" }],
        },
      });
      transaction.match.updateMany.mockResolvedValue({ count: 1 });
      transaction.match.findUniqueOrThrow.mockResolvedValue({
        id: "match-1",
        status: "VALIDATED",
        scoreStatus: "VALIDATED",
        winnerId: "player-2",
      });
      transaction.auditLog.create.mockResolvedValue({});
    });

    it("validates and advances the retained winner when arbitrating a score", async () => {
      const score = [
        { p1: 4, p2: 6 },
        { p1: 6, p2: 3 },
        { p1: 4, p2: 6 },
      ];

      await new PrismaMatchRepository().arbitrateScore("match-1", "admin-1", {
        score,
        resultKind: "NORMAL",
      });

      expect(transaction.match.updateMany).toHaveBeenNthCalledWith(1, {
        where: expect.objectContaining({
          id: "match-1",
          status: "CORRECTION_PROPOSED",
          version: 8,
        }),
        data: expect.objectContaining({
          winnerId: "player-2",
          score,
          status: "VALIDATED",
          scoreStatus: "VALIDATED",
        }),
      });
      expect(transaction.match.updateMany).toHaveBeenNthCalledWith(2, {
        where: {
          id: "next-match",
          status: "PENDING",
          player2Id: null,
        },
        data: { player2Id: "player-2", version: { increment: 1 } },
      });
      expect(transaction.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "ARBITRATE_SCORE" }),
        }),
      );
    });

    it("rejects a score that determines a different winner", async () => {
      await expect(
        new PrismaMatchRepository().arbitrateScore("match-1", "admin-1", {
          score: [
            { p1: 6, p2: 4 },
            { p1: 6, p2: 3 },
          ],
          resultKind: "NORMAL",
        }),
      ).rejects.toThrow(
        "Le score arbitré ne correspond pas au vainqueur proposé.",
      );
      expect(transaction.match.updateMany).not.toHaveBeenCalled();
    });
  });

  it("stores a same-winner score contest without validating or advancing", async () => {
    await expect(
      new PrismaMatchRepository().contestScore("match-1", "player-2", {
        score: submittedScore,
      }),
    ).resolves.toMatchObject({
      status: "CORRECTION_PROPOSED",
      scoreStatus: "CORRECTION_PROPOSED",
      winnerId: null,
      declaredWinnerId: "player-2",
      proposedWinnerId: "player-2",
      proposedScore: submittedScore,
      score: null,
    });

    expect(transaction.match.updateMany).toHaveBeenCalledWith({
      where: {
        id: "match-1",
        status: "DECLARED",
        scoreStatus: "DECLARED",
        version: 5,
        declaredById: "player-1",
        declaredWinnerId: "player-2",
        tournament: { status: "IN_PROGRESS" },
      },
      data: {
        proposedWinnerId: "player-2",
        proposedScore: submittedScore,
        status: "CORRECTION_PROPOSED",
        scoreStatus: "CORRECTION_PROPOSED",
        version: { increment: 1 },
      },
    });
  });

  it("rejects a score whose winner differs from the declared winner", async () => {
    await expect(
      new PrismaMatchRepository().contestScore("match-1", "player-2", {
        score: [
          { p1: 6, p2: 4 },
          { p1: 6, p2: 3 },
        ],
      }),
    ).rejects.toThrow("Le score contesté doit conserver le vainqueur déclaré.");

    expect(transaction.match.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a concurrent score contest", async () => {
    transaction.match.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      new PrismaMatchRepository().contestScore("match-1", "player-2", {
        score: submittedScore,
      }),
    ).rejects.toThrow(ConflictError);

    expect(transaction.match.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});

vi.mock("@/server/db/prisma", () => ({
  prisma: { $transaction, match: { findMany, findUnique } },
}));

import { PrismaMatchRepository } from "@/server/matches/match.repository";

describe("PrismaMatchRepository.getDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns match details and tournament settings without embedding behavior", async () => {
    findUnique.mockResolvedValue({
      id: "match-1",
      tournamentId: "tournament-1",
      round: 2,
      position: 0,
      player1: { id: "player-1", name: "Ada Lovelace" },
      player2: { id: "player-2", name: "Grace Hopper" },
      status: "PENDING",
      scoreStatus: "NONE",
      resultKind: null,
      winnerId: null,
      declaredById: null,
      declaredWinnerId: null,
      proposedWinnerId: null,
      score: null,
      proposedScore: null,
      isBye: false,
      scheduledAt: new Date("2026-10-03T16:30:00.000Z"),
      court: "Court 2",
      tournament: {
        name: "Club Open",
        status: "IN_PROGRESS",
        finalSetSuperTiebreak: true,
        matches: [{ round: 1 }, { round: 2 }, { round: 3 }],
      },
    });

    await expect(
      new PrismaMatchRepository().getDetails("match-1"),
    ).resolves.toEqual({
      tournamentId: "tournament-1",
      tournamentName: "Club Open",
      roundLabel: "Demi-finales",
      tournamentStatus: "IN_PROGRESS",
      finalSetSuperTiebreak: true,
      match: {
        id: "match-1",
        round: 2,
        position: 0,
        player1: { id: "player-1", name: "Ada Lovelace" },
        player2: { id: "player-2", name: "Grace Hopper" },
        status: "PENDING",
        scoreStatus: "NONE",
        resultKind: null,
        winnerId: null,
        declaredById: null,
        declaredWinnerId: null,
        proposedWinnerId: null,
        score: null,
        proposedScore: null,
        isBye: false,
        scheduledAt: "2026-10-03T16:30:00.000Z",
        court: "Court 2",
      },
    });
  });
});

describe("PrismaMatchRepository.listForArbitration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists unresolved match proposals with public player and tournament data", async () => {
    findMany.mockResolvedValue([
      {
        id: "match-1",
        tournamentId: "tournament-1",
        round: 2,
        position: 0,
        status: "CORRECTION_PROPOSED",
        scoreStatus: "CORRECTION_PROPOSED",
        declaredWinnerId: "player-1",
        proposedWinnerId: "player-2",
        declaredScore: [
          { p1: 6, p2: 4 },
          { p1: 6, p2: 3 },
        ],
        proposedScore: [
          { p1: 4, p2: 6 },
          { p1: 3, p2: 6 },
        ],
        player1: { id: "player-1", name: "Ada Lovelace" },
        player2: { id: "player-2", name: "Grace Hopper" },
        tournament: {
          name: "Club Open",
          finalSetSuperTiebreak: false,
        },
      },
    ]);

    await expect(
      new PrismaMatchRepository().listForArbitration(),
    ).resolves.toEqual([
      {
        id: "match-1",
        tournamentId: "tournament-1",
        tournamentName: "Club Open",
        round: 2,
        position: 0,
        status: "CORRECTION_PROPOSED",
        scoreStatus: "CORRECTION_PROPOSED",
        declaredWinnerId: "player-1",
        proposedWinnerId: "player-2",
        declaredScore: [
          { p1: 6, p2: 4 },
          { p1: 6, p2: 3 },
        ],
        proposedScore: [
          { p1: 4, p2: 6 },
          { p1: 3, p2: 6 },
        ],
        player1: { id: "player-1", name: "Ada Lovelace" },
        player2: { id: "player-2", name: "Grace Hopper" },
        finalSetSuperTiebreak: false,
      },
    ]);
  });
});

describe("PrismaMatchRepository.correctResult", () => {
  const currentMatch = {
    id: "match-1",
    tournamentId: "tournament-1",
    round: 1,
    position: 0,
    status: "VALIDATED",
    scoreStatus: "VALIDATED",
    isBye: false,
    player1Id: "player-1",
    player2Id: "player-2",
    winnerId: "player-1",
    declaredById: "player-2",
    declaredWinnerId: "player-1",
    declaredScore: [
      { p1: 6, p2: 4 },
      { p1: 6, p2: 3 },
    ],
    proposedWinnerId: "player-1",
    proposedScore: [
      { p1: 6, p2: 4 },
      { p1: 6, p2: 3 },
    ],
    score: [
      { p1: 6, p2: 4 },
      { p1: 6, p2: 3 },
    ],
    resultKind: "NORMAL",
    version: 9,
    nextMatchId: "next-match",
    nextSlot: 2,
    tournament: {
      status: "IN_PROGRESS",
      finalSetSuperTiebreak: false,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    $transaction.mockImplementation((callback) => callback(transaction));
    transaction.match.findUnique.mockResolvedValue(currentMatch);
    transaction.match.updateMany.mockResolvedValue({ count: 1 });
    transaction.match.findUniqueOrThrow.mockResolvedValue({
      id: "match-1",
      status: "VALIDATED",
      scoreStatus: "VALIDATED",
      winnerId: "player-2",
      proposedWinnerId: "player-2",
      resultKind: "NORMAL",
      score: [
        { p1: 4, p2: 6 },
        { p1: 3, p2: 6 },
      ],
    });
    transaction.auditLog.create.mockResolvedValue({});
  });

  it("replaces a corrected winner in the still-pending next match and audits both values", async () => {
    const score = [
      { p1: 4, p2: 6 },
      { p1: 3, p2: 6 },
    ];

    await expect(
      new PrismaMatchRepository().correctResult("match-1", "admin-1", {
        winnerId: "player-2",
        score,
        reason: "La feuille officielle confirme l’autre vainqueur.",
      }),
    ).resolves.toMatchObject({
      status: "VALIDATED",
      winnerId: "player-2",
    });

    expect(transaction.match.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: "next-match",
        status: "PENDING",
        player2Id: "player-1",
      },
      data: { player2Id: "player-2", version: { increment: 1 } },
    });
    expect(transaction.match.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: "match-1",
        status: "VALIDATED",
        scoreStatus: "VALIDATED",
        version: 9,
        tournament: { status: "IN_PROGRESS" },
      },
      data: {
        winnerId: "player-2",
        proposedWinnerId: "player-2",
        score,
        proposedScore: score,
        resultKind: "NORMAL",
        version: { increment: 1 },
      },
    });
    expect(transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "CORRECT_RESULT",
          actorId: "admin-1",
          reason: "La feuille officielle confirme l’autre vainqueur.",
          before: expect.objectContaining({ winnerId: "player-1" }),
          after: expect.objectContaining({ winnerId: "player-2" }),
        }),
      }),
    );
  });

  it("corrects only the score without changing the next match", async () => {
    const score = [
      { p1: 7, p2: 5 },
      { p1: 6, p2: 3 },
    ];

    await new PrismaMatchRepository().correctResult("match-1", "admin-1", {
      score,
      reason: "Une erreur de transcription a été corrigée.",
    });

    expect(transaction.match.updateMany).toHaveBeenCalledTimes(1);
    expect(transaction.match.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "match-1" }),
        data: expect.objectContaining({
          winnerId: "player-1",
          score,
        }),
      }),
    );
    expect(transaction.auditLog.create).toHaveBeenCalledOnce();
  });

  it("rejects a winner correction if the next match is not pending", async () => {
    transaction.match.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      new PrismaMatchRepository().correctResult("match-1", "admin-1", {
        winnerId: "player-2",
        score: [
          { p1: 4, p2: 6 },
          { p1: 3, p2: 6 },
        ],
        reason: "Correction vérifiée.",
      }),
    ).rejects.toThrow(ConflictError);
    expect(transaction.match.updateMany).toHaveBeenCalledOnce();
    expect(transaction.auditLog.create).not.toHaveBeenCalled();
  });

  it("rejects tournament-finalized corrections and unchanged results", async () => {
    transaction.match.findUnique.mockResolvedValueOnce({
      ...currentMatch,
      tournament: { ...currentMatch.tournament, status: "FINISHED" },
    });
    await expect(
      new PrismaMatchRepository().correctResult("match-1", "admin-1", {
        score: currentMatch.score,
        reason: "Vérification.",
      }),
    ).rejects.toThrow(ConflictError);

    transaction.match.findUnique.mockResolvedValueOnce(currentMatch);
    await expect(
      new PrismaMatchRepository().correctResult("match-1", "admin-1", {
        score: currentMatch.score,
        reason: "Vérification.",
      }),
    ).rejects.toThrow("La correction ne modifie pas le résultat existant.");
    expect(transaction.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("PrismaMatchRepository.listForCorrection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns validated non-bye matches from active tournaments", async () => {
    findMany.mockResolvedValue([
      {
        id: "match-1",
        tournamentId: "tournament-1",
        round: 1,
        position: 0,
        winnerId: "player-1",
        score: [
          { p1: 6, p2: 4 },
          { p1: 6, p2: 3 },
        ],
        resultKind: "NORMAL",
        player1: { id: "player-1", name: "Ada Lovelace" },
        player2: { id: "player-2", name: "Grace Hopper" },
        tournament: { name: "Club Open" },
      },
    ]);

    await expect(
      new PrismaMatchRepository().listForCorrection(),
    ).resolves.toMatchObject([
      {
        id: "match-1",
        winnerId: "player-1",
        tournamentName: "Club Open",
        resultKind: "NORMAL",
      },
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "VALIDATED",
          scoreStatus: "VALIDATED",
          isBye: false,
          tournament: { status: "IN_PROGRESS" },
          winnerId: { not: null },
        },
      }),
    );
  });
});

describe("PrismaMatchRepository.listUpcomingForPlayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns assigned pending matches with only the opponent's public name", async () => {
    findMany.mockResolvedValue([
      {
        id: "match-1",
        tournamentId: "tournament-1",
        round: 2,
        player1Id: "player-1",
        player1: { name: "Ada Lovelace" },
        player2: { name: "Grace Hopper" },
        tournament: {
          name: "Club Open",
          matches: [{ round: 1 }, { round: 2 }, { round: 3 }],
        },
        scheduledAt: new Date("2026-10-03T16:30:00.000Z"),
        court: "Court 2",
      },
    ]);

    await expect(
      new PrismaMatchRepository().listUpcomingForPlayer("player-1"),
    ).resolves.toEqual([
      {
        id: "match-1",
        tournamentId: "tournament-1",
        tournamentName: "Club Open",
        round: 2,
        roundLabel: "Demi-finales",
        playerName: "Ada Lovelace",
        opponentName: "Grace Hopper",
        scheduledAt: "2026-10-03T16:30:00.000Z",
        court: "Court 2",
      },
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "PENDING",
          isBye: false,
          player1Id: { not: null },
          player2Id: { not: null },
          OR: [{ player1Id: "player-1" }, { player2Id: "player-1" }],
        }),
      }),
    );
  });

  it("returns an unscheduled match with null time and court", async () => {
    findMany.mockResolvedValue([
      {
        id: "match-2",
        tournamentId: "tournament-1",
        round: 1,
        player1Id: "player-1",
        player1: { name: "Ada Lovelace" },
        player2: { name: "Grace Hopper" },
        tournament: {
          name: "Club Open",
          matches: [{ round: 1 }, { round: 2 }],
        },
        scheduledAt: null,
        court: null,
      },
    ]);

    await expect(
      new PrismaMatchRepository().listUpcomingForPlayer("player-1"),
    ).resolves.toMatchObject([
      {
        id: "match-2",
        roundLabel: "Demi-finales",
        scheduledAt: null,
        court: null,
      },
    ]);
  });
});

describe("PrismaMatchRepository.declare", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    $transaction.mockImplementation((callback) => callback(transaction));
  });

  it("stores the initial declaration without validating or advancing the winner", async () => {
    transaction.match.findUnique.mockResolvedValue({
      status: "PENDING",
      isBye: false,
      player1Id: "player-1",
      player2Id: "player-2",
      version: 3,
      tournament: {
        status: "IN_PROGRESS",
        finalSetSuperTiebreak: false,
      },
    });
    transaction.match.updateMany.mockResolvedValue({ count: 1 });
    const declaredMatch = {
      id: "match-1",
      status: "DECLARED",
      scoreStatus: "DECLARED",
      winnerId: null,
      score: null,
      declaredById: "player-1",
      declaredWinnerId: "player-2",
      proposedWinnerId: "player-2",
    };
    transaction.match.findUniqueOrThrow.mockResolvedValue(declaredMatch);

    const result = await new PrismaMatchRepository().declare(
      "match-1",
      "player-1",
      {
        winnerId: "player-2",
        score: [
          { p1: 4, p2: 6 },
          { p1: 6, p2: 3 },
          { p1: 4, p2: 6 },
        ],
      },
    );

    expect(result).toEqual(declaredMatch);
    expect(transaction.match.updateMany).toHaveBeenCalledWith({
      where: {
        id: "match-1",
        status: "PENDING",
        version: 3,
        tournament: { status: "IN_PROGRESS" },
      },
      data: {
        declaredById: "player-1",
        declaredWinnerId: "player-2",
        declaredScore: [
          { p1: 4, p2: 6 },
          { p1: 6, p2: 3 },
          { p1: 4, p2: 6 },
        ],
        proposedWinnerId: "player-2",
        proposedScore: [
          { p1: 4, p2: 6 },
          { p1: 6, p2: 3 },
          { p1: 4, p2: 6 },
        ],
        scoreStatus: "DECLARED",
        status: "DECLARED",
        version: { increment: 1 },
      },
    });
  });
  describe("PrismaMatchRepository.confirm", () => {
    const declaredScore = [
      { p1: 4, p2: 6 },
      { p1: 6, p2: 3 },
      { p1: 4, p2: 6 },
    ];

    function declaredMatch(overrides: Record<string, unknown> = {}) {
      return {
        id: "match-1",
        tournamentId: "tournament-1",
        round: 1,
        position: 0,
        status: "DECLARED",
        scoreStatus: "DECLARED",
        isBye: false,
        player1Id: "player-1",
        player2Id: "player-2",
        declaredById: "player-1",
        declaredWinnerId: "player-2",
        declaredScore,
        version: 3,
        nextMatchId: "final-match",
        nextSlot: 1,
        tournament: {
          status: "IN_PROGRESS",
          finalSetSuperTiebreak: false,
          matches: [{ id: "final-match" }],
        },
        ...overrides,
      };
    }

    beforeEach(() => {
      vi.clearAllMocks();
      $transaction.mockImplementation((callback) => callback(transaction));
      transaction.match.findUnique.mockResolvedValue(declaredMatch());
      transaction.match.findFirst.mockResolvedValue(null);
      transaction.match.updateMany.mockResolvedValue({ count: 1 });
      transaction.tournament.updateMany.mockResolvedValue({ count: 1 });
      transaction.match.findUniqueOrThrow.mockResolvedValue({
        id: "match-1",
        winnerId: "player-2",
        score: declaredScore,
        status: "VALIDATED",
        scoreStatus: "VALIDATED",
      });
    });

    it("validates the result and advances the winner in one transaction", async () => {
      await expect(
        new PrismaMatchRepository().confirm("match-1", "player-2"),
      ).resolves.toMatchObject({
        id: "match-1",
        winnerId: "player-2",
        score: declaredScore,
        status: "VALIDATED",
        scoreStatus: "VALIDATED",
      });

      expect(transaction.match.updateMany).toHaveBeenNthCalledWith(1, {
        where: {
          id: "match-1",
          status: "DECLARED",
          scoreStatus: "DECLARED",
          version: 3,
          declaredById: { not: "player-2" },
          tournament: { status: "IN_PROGRESS" },
        },
        data: {
          winnerId: "player-2",
          score: declaredScore,
          status: "VALIDATED",
          scoreStatus: "VALIDATED",
          version: { increment: 1 },
        },
      });
      expect(transaction.match.updateMany).toHaveBeenNthCalledWith(2, {
        where: {
          id: "final-match",
          status: "PENDING",
          player1Id: null,
        },
        data: { player1Id: "player-2", version: { increment: 1 } },
      });
      expect(transaction.tournament.updateMany).not.toHaveBeenCalled();
    });

    it("advances a winner to the second slot when configured", async () => {
      transaction.match.findUnique.mockResolvedValue(
        declaredMatch({ nextSlot: 2 }),
      );

      await new PrismaMatchRepository().confirm("match-1", "player-2");

      expect(transaction.match.updateMany).toHaveBeenNthCalledWith(2, {
        where: {
          id: "final-match",
          status: "PENDING",
          player2Id: null,
        },
        data: { player2Id: "player-2", version: { increment: 1 } },
      });
    });

    it("closes the tournament when its final match is validated", async () => {
      transaction.match.findUnique.mockResolvedValue(
        declaredMatch({
          round: 2,
          nextMatchId: null,
          nextSlot: null,
          tournament: {
            status: "IN_PROGRESS",
            finalSetSuperTiebreak: false,
            matches: [{ id: "match-1" }],
          },
        }),
      );

      await new PrismaMatchRepository().confirm("match-1", "player-2");

      expect(transaction.match.findFirst).toHaveBeenCalledWith({
        where: {
          tournamentId: "tournament-1",
          id: { not: "match-1" },
          status: { not: "VALIDATED" },
        },
        select: { id: true },
      });
      expect(transaction.tournament.updateMany).toHaveBeenCalledWith({
        where: { id: "tournament-1", status: "IN_PROGRESS" },
        data: { status: "FINISHED" },
      });
      expect(transaction.match.updateMany).toHaveBeenCalledTimes(1);
    });

    it("does not close a tournament while another match is unfinished", async () => {
      transaction.match.findUnique.mockResolvedValue(
        declaredMatch({
          round: 2,
          nextMatchId: null,
          nextSlot: null,
          tournament: {
            status: "IN_PROGRESS",
            finalSetSuperTiebreak: false,
            matches: [{ id: "match-1" }],
          },
        }),
      );
      transaction.match.findFirst.mockResolvedValue({ id: "unfinished-match" });

      await expect(
        new PrismaMatchRepository().confirm("match-1", "player-2"),
      ).rejects.toThrow(ConflictError);

      expect(transaction.match.updateMany).not.toHaveBeenCalled();
      expect(transaction.tournament.updateMany).not.toHaveBeenCalled();
    });

    it("does not validate a result twice after a concurrent confirmation", async () => {
      transaction.match.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        new PrismaMatchRepository().confirm("match-1", "player-2"),
      ).rejects.toThrow(ConflictError);

      expect(transaction.match.updateMany).toHaveBeenCalledTimes(1);
      expect(transaction.tournament.updateMany).not.toHaveBeenCalled();
    });

    it("rejects advancement if the winner's next-round slot is no longer empty", async () => {
      transaction.match.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });

      await expect(
        new PrismaMatchRepository().confirm("match-1", "player-2"),
      ).rejects.toThrow(ConflictError);

      expect(transaction.match.findUniqueOrThrow).not.toHaveBeenCalled();
      expect(transaction.tournament.updateMany).not.toHaveBeenCalled();
    });

    it("rejects finalization if the tournament status changed concurrently", async () => {
      transaction.match.findUnique.mockResolvedValue(
        declaredMatch({
          round: 2,
          nextMatchId: null,
          nextSlot: null,
          tournament: {
            status: "IN_PROGRESS",
            finalSetSuperTiebreak: false,
            matches: [{ id: "match-1" }],
          },
        }),
      );
      transaction.tournament.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        new PrismaMatchRepository().confirm("match-1", "player-2"),
      ).rejects.toThrow(ConflictError);

      expect(transaction.match.findUniqueOrThrow).not.toHaveBeenCalled();
    });
  });

  describe("PrismaMatchRepository.declare edge cases", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      $transaction.mockImplementation((callback) => callback(transaction));
    });

    it("rejects a concurrent declaration if the match version changed", async () => {
      transaction.match.findUnique.mockResolvedValue({
        status: "PENDING",
        isBye: false,
        player1Id: "player-1",
        player2Id: "player-2",
        version: 3,
        tournament: {
          status: "IN_PROGRESS",
          finalSetSuperTiebreak: false,
        },
      });
      transaction.match.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        new PrismaMatchRepository().declare("match-1", "player-1", {
          winnerId: "player-1",
          score: [
            { p1: 6, p2: 4 },
            { p1: 6, p2: 3 },
          ],
        }),
      ).rejects.toThrow(ConflictError);
      expect(transaction.match.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it("rejects a winner that contradicts the validated score", async () => {
      transaction.match.findUnique.mockResolvedValue({
        status: "PENDING",
        isBye: false,
        player1Id: "player-1",
        player2Id: "player-2",
        version: 0,
        tournament: {
          status: "IN_PROGRESS",
          finalSetSuperTiebreak: false,
        },
      });

      await expect(
        new PrismaMatchRepository().declare("match-1", "player-1", {
          winnerId: "player-2",
          score: [
            { p1: 6, p2: 4 },
            { p1: 6, p2: 3 },
          ],
        }),
      ).rejects.toThrow("Le vainqueur indiqué ne correspond pas au score.");
      expect(transaction.match.updateMany).not.toHaveBeenCalled();
    });
  });

  describe("PrismaMatchRepository.proposeCorrection", () => {
    const alternateScore = [
      { p1: 6, p2: 4 },
      { p1: 6, p2: 3 },
    ];

    beforeEach(() => {
      vi.clearAllMocks();
      $transaction.mockImplementation((callback) => callback(transaction));
      transaction.match.findUnique.mockResolvedValue({
        id: "match-1",
        status: "DECLARED",
        scoreStatus: "DECLARED",
        isBye: false,
        player1Id: "player-1",
        player2Id: "player-2",
        declaredById: "player-2",
        declaredWinnerId: "player-2",
        version: 4,
        tournament: {
          status: "IN_PROGRESS",
          finalSetSuperTiebreak: false,
        },
      });

      transaction.match.updateMany.mockResolvedValue({ count: 1 });
      transaction.match.findUniqueOrThrow.mockResolvedValue({
        id: "match-1",
        status: "CORRECTION_PROPOSED",
        scoreStatus: "CORRECTION_PROPOSED",
        winnerId: null,
        declaredWinnerId: "player-2",
        proposedWinnerId: "player-1",
        score: null,
        proposedScore: alternateScore,
      });
    });

    it("stores an opponent's alternate result without validating or advancing", async () => {
      await expect(
        new PrismaMatchRepository().proposeCorrection("match-1", "player-1", {
          winnerId: "player-1",
          score: alternateScore,
        }),
      ).resolves.toMatchObject({
        id: "match-1",
        status: "CORRECTION_PROPOSED",
        scoreStatus: "CORRECTION_PROPOSED",
        winnerId: null,
        declaredWinnerId: "player-2",
        proposedWinnerId: "player-1",
        score: null,
        proposedScore: alternateScore,
      });

      expect(transaction.match.updateMany).toHaveBeenCalledWith({
        where: {
          id: "match-1",
          status: "DECLARED",
          scoreStatus: "DECLARED",
          version: 4,
          declaredById: "player-2",
          tournament: { status: "IN_PROGRESS" },
        },
        data: {
          proposedWinnerId: "player-1",
          proposedScore: alternateScore,
          status: "CORRECTION_PROPOSED",
          scoreStatus: "CORRECTION_PROPOSED",
          version: { increment: 1 },
        },
      });
    });

    it("rejects an alternate winner that does not match the submitted score", async () => {
      await expect(
        new PrismaMatchRepository().proposeCorrection("match-1", "player-1", {
          winnerId: "player-1",
          score: [
            { p1: 4, p2: 6 },
            { p1: 3, p2: 6 },
          ],
        }),
      ).rejects.toThrow("Le vainqueur indiqué ne correspond pas au score.");

      expect(transaction.match.updateMany).not.toHaveBeenCalled();
    });

    it("rejects a concurrent correction proposal", async () => {
      transaction.match.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        new PrismaMatchRepository().proposeCorrection("match-1", "player-1", {
          winnerId: "player-1",
          score: alternateScore,
        }),
      ).rejects.toThrow(ConflictError);

      expect(transaction.match.findUniqueOrThrow).not.toHaveBeenCalled();
    });
  });
});
