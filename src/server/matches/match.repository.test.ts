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
      winnerId: null,
      declaredById: null,
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
        winnerId: null,
        declaredById: null,
        score: null,
        proposedScore: null,
        isBye: false,
        scheduledAt: "2026-10-03T16:30:00.000Z",
        court: "Court 2",
      },
    });
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
