import type { Tournament } from "@/generated/prisma/client";
import type { TournamentStatus } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import type { BracketRound, MatchDto, SetScore } from "@/types/bracket";
import {
  computeRoundCount,
  generateFirstRoundMatches,
} from "@/server/bracket/bracket.generator";
import { prisma } from "@/server/db/prisma";
import { ConflictError, NotFoundError } from "@/server/errors/app-error";
import { persistedScoreSchema } from "@/server/score/score.validator";
import {
  guardActivation,
  guardDraw,
  guardParticipantsMutation,
} from "@/server/tournaments/tournament.rules";

export type TournamentSummary = Pick<
  Tournament,
  "id" | "name" | "startDate" | "status" | "finalSetSuperTiebreak"
>;

export type TournamentPage = {
  items: TournamentSummary[];
  page: number;
  pageSize: number;
  total: number;
};

export type CreateTournamentData = {
  name: string;
  startDate?: string;
  finalSetSuperTiebreak: boolean;
};

export type TournamentParticipant = {
  id: string;
  tournamentId: string;
  userId: string;
  name: string;
  seed: number | null;
};

export type TournamentParticipants = {
  status: TournamentStatus;
  canEdit: boolean;
  hasDraw: boolean;
  items: TournamentParticipant[];
};

export type TournamentMatch = {
  id: string;
  round: number;
  position: number;
  player1Id: string | null;
  player2Id: string | null;
  winnerId: string | null;
  isBye: boolean;
  nextMatchId: string | null;
  nextSlot: number | null;
};

export type TournamentBracket = {
  tournament: {
    id: string;
    name: string;
    startDate: string | null;
    finalSetSuperTiebreak: boolean;
    status: TournamentStatus;
  };
  rounds: BracketRound[];
};

export interface TournamentRepository {
  findPage(input: {
    status?: TournamentStatus;
    page: number;
    pageSize: number;
  }): Promise<TournamentPage>;
  create(data: CreateTournamentData): Promise<TournamentSummary>;
  listParticipants(tournamentId: string): Promise<TournamentParticipants>;
  getBracket(tournamentId: string): Promise<TournamentBracket>;
  addParticipant(
    tournamentId: string,
    data: { userId: string; seed?: number },
  ): Promise<TournamentParticipant>;
  updateParticipantSeed(
    tournamentId: string,
    participantId: string,
    seed: number | null,
  ): Promise<TournamentParticipant>;
  removeParticipant(tournamentId: string, participantId: string): Promise<void>;
  draw(tournamentId: string, actorId: string): Promise<TournamentMatch[]>;
  activate(tournamentId: string, actorId: string): Promise<TournamentSummary>;
}

async function clearTournamentDraw(
  transaction: Prisma.TransactionClient,
  tournamentId: string,
): Promise<void> {
  await transaction.match.updateMany({
    where: { tournamentId },
    data: { nextMatchId: null, nextSlot: null },
  });
  await transaction.match.deleteMany({ where: { tournamentId } });
}

function parseScore(value: Prisma.JsonValue | null): SetScore[] | null {
  if (value === null) {
    return null;
  }

  const result = persistedScoreSchema.safeParse(value);
  if (!result.success) {
    throw new Error("Le score enregistré du match a un format invalide.");
  }

  return result.data;
}

export class PrismaTournamentRepository implements TournamentRepository {
  /** Returns a page of tournaments, optionally filtered by status. */
  async findPage(input: {
    status?: TournamentStatus;
    page: number;
    pageSize: number;
  }): Promise<TournamentPage> {
    const where = input.status ? { status: input.status } : {};
    const [items, total] = await Promise.all([
      prisma.tournament.findMany({
        where,
        select: {
          id: true,
          name: true,
          startDate: true,
          status: true,
          finalSetSuperTiebreak: true,
        },
        orderBy: { name: "asc" },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      prisma.tournament.count({ where }),
    ]);

    return {
      items,
      page: input.page,
      pageSize: input.pageSize,
      total,
    };
  }

  /** Creates a tournament and returns its summary. */
  create(data: CreateTournamentData): Promise<TournamentSummary> {
    return prisma.tournament.create({
      data: {
        name: data.name,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        finalSetSuperTiebreak: data.finalSetSuperTiebreak,
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        status: true,
        finalSetSuperTiebreak: true,
      },
    });
  }

  /** Returns the participants of a tournament along with its edit status. */
  async listParticipants(
    tournamentId: string,
  ): Promise<TournamentParticipants> {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        status: true,
        matches: { select: { id: true }, take: 1 },
        participants: {
          select: {
            id: true,
            tournamentId: true,
            userId: true,
            seed: true,
            user: { select: { name: true } },
          },
          orderBy: [{ seed: "asc" }, { user: { name: "asc" } }],
        },
      },
    });

    if (!tournament) {
      throw new NotFoundError("Tournoi introuvable.");
    }

    return {
      status: tournament.status,
      canEdit: tournament.status === "DRAFT",
      hasDraw: tournament.matches.length > 0,
      items: tournament.participants.map(({ user, ...participant }) => ({
        ...participant,
        name: user.name,
      })),
    };
  }

  /** Returns the stored bracket grouped by round, with public player data. */
  async getBracket(tournamentId: string): Promise<TournamentBracket> {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        name: true,
        startDate: true,
        finalSetSuperTiebreak: true,
        status: true,
        matches: {
          orderBy: [{ round: "asc" }, { position: "asc" }],
          select: {
            id: true,
            round: true,
            position: true,
            player1: { select: { id: true, name: true } },
            player2: { select: { id: true, name: true } },
            status: true,
            scoreStatus: true,
            winnerId: true,
            declaredById: true,
            declaredWinnerId: true,
            proposedWinnerId: true,
            resultKind: true,
            score: true,
            proposedScore: true,
            isBye: true,
            scheduledAt: true,
            court: true,
          },
        },
      },
    });

    if (!tournament) {
      throw new NotFoundError("Tournoi introuvable.");
    }

    const matches: MatchDto[] = tournament.matches.map((match) => ({
      id: match.id,
      round: match.round,
      position: match.position,
      player1: match.player1,
      player2: match.player2,
      status: match.status,
      scoreStatus: match.scoreStatus,
      winnerId: match.winnerId,
      declaredById: match.declaredById,
      declaredWinnerId: match.declaredWinnerId,
      proposedWinnerId: match.proposedWinnerId,
      resultKind: match.resultKind,
      score: parseScore(match.score),
      proposedScore: parseScore(match.proposedScore),
      isBye: match.isBye,
      scheduledAt: match.scheduledAt?.toISOString() ?? null,
      court: match.court,
    }));
    const matchesByRound = new Map<number, MatchDto[]>();

    for (const match of matches) {
      const roundMatches = matchesByRound.get(match.round) ?? [];
      roundMatches.push(match);
      matchesByRound.set(match.round, roundMatches);
    }

    return {
      tournament: {
        ...tournament,
        startDate: tournament.startDate?.toISOString() ?? null,
      },
      rounds: [...matchesByRound.entries()].map(([round, roundMatches]) => ({
        round,
        matches: roundMatches,
      })),
    };
  }

  /**
   * Registers a member and invalidates any previous draw in the same
   * transaction.
   */
  async addParticipant(
    tournamentId: string,
    data: { userId: string; seed?: number },
  ): Promise<TournamentParticipant> {
    try {
      return await prisma.$transaction(async (transaction) => {
        const tournament = await transaction.tournament.findUnique({
          where: { id: tournamentId },
          select: {
            status: true,
            matches: { select: { id: true }, take: 1 },
          },
        });

        if (!tournament) {
          throw new NotFoundError("Tournoi introuvable.");
        }

        guardParticipantsMutation(tournament.status);
        await clearTournamentDraw(transaction, tournamentId);

        const member = await transaction.user.findFirst({
          where: {
            id: data.userId,
            role: "MEMBER",
            anonymized: false,
          },
          select: { id: true },
        });

        if (!member) {
          throw new NotFoundError("Membre introuvable.");
        }

        const participant = await transaction.participant.create({
          data: {
            tournamentId,
            userId: data.userId,
            seed: data.seed,
          },
          select: {
            id: true,
            tournamentId: true,
            userId: true,
            seed: true,
            user: { select: { name: true } },
          },
        });

        return { ...participant, name: participant.user.name };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictError(
          "Ce membre est déjà inscrit ou ce numéro de tête de série est déjà attribué.",
        );
      }

      throw error;
    }
  }

  /**
   * Updates or clears a participant's seed and invalidates any previous draw.
   */
  async updateParticipantSeed(
    tournamentId: string,
    participantId: string,
    seed: number | null,
  ): Promise<TournamentParticipant> {
    try {
      return await prisma.$transaction(async (transaction) => {
        const tournament = await transaction.tournament.findUnique({
          where: { id: tournamentId },
          select: {
            status: true,
            matches: { select: { id: true }, take: 1 },
          },
        });

        if (!tournament) {
          throw new NotFoundError("Tournoi introuvable.");
        }

        guardParticipantsMutation(tournament.status);

        const participant = await transaction.participant.findFirst({
          where: { id: participantId, tournamentId },
          select: { id: true },
        });

        if (!participant) {
          throw new NotFoundError("Participant introuvable dans ce tournoi.");
        }

        await clearTournamentDraw(transaction, tournamentId);

        const updated = await transaction.participant.update({
          where: { id: participantId },
          data: { seed },
          select: {
            id: true,
            tournamentId: true,
            userId: true,
            seed: true,
            user: { select: { name: true } },
          },
        });

        return { ...updated, name: updated.user.name };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictError(
          "Ce numéro de tête de série est déjà attribué dans ce tournoi.",
        );
      }

      throw error;
    }
  }

  /** Removes a participant and invalidates the existing draw atomically. */
  async removeParticipant(
    tournamentId: string,
    participantId: string,
  ): Promise<void> {
    await prisma.$transaction(async (transaction) => {
      const tournament = await transaction.tournament.findUnique({
        where: { id: tournamentId },
        select: { status: true },
      });

      if (!tournament) {
        throw new NotFoundError("Tournoi introuvable.");
      }

      guardParticipantsMutation(tournament.status);

      const participant = await transaction.participant.findFirst({
        where: { id: participantId, tournamentId },
        select: { id: true },
      });

      if (!participant) {
        throw new NotFoundError("Participant introuvable dans ce tournoi.");
      }

      await clearTournamentDraw(transaction, tournamentId);
      await transaction.participant.delete({ where: { id: participantId } });
    });
  }

  /**
   * Generates (or regenerates) the tournament's bracket: clears any previous
   * draw, creates every round linked via nextMatchId/nextSlot, auto-advances
   * bye winners into the following round, and records the action in the
   * audit log — all within a single transaction.
   */
  async draw(
    tournamentId: string,
    actorId: string,
  ): Promise<TournamentMatch[]> {
    return prisma.$transaction(async (transaction) => {
      const tournament = await transaction.tournament.findUnique({
        where: { id: tournamentId },
        select: {
          status: true,
          matches: { select: { id: true } },
          participants: { select: { userId: true, seed: true } },
        },
      });

      if (!tournament) {
        throw new NotFoundError("Tournoi introuvable.");
      }

      guardDraw(tournament.status);

      // Matches reference players by userId (not Participant.id), since
      // that is what Match.player1Id/player2Id point to in the schema.
      const firstRound = generateFirstRoundMatches(
        tournament.participants.map((participant) => ({
          id: participant.userId,
          seed: participant.seed,
        })),
      );
      const matchCountBefore = tournament.matches.length;

      // Regenerating a draw discards the previous one entirely.
      await clearTournamentDraw(transaction, tournamentId);

      const bracketSize = firstRound.length * 2;
      const roundCount = computeRoundCount(bracketSize);
      const allMatches: TournamentMatch[] = [];
      let parentRoundMatches: TournamentMatch[] = [];

      // Create every round from the final down to round 1, so each match
      // can be linked to its already-created parent via nextMatchId/nextSlot.
      for (let round = roundCount; round >= 1; round -= 1) {
        const matchCountAtRound = bracketSize / 2 ** round;
        const currentRoundMatches: TournamentMatch[] = [];

        for (let position = 0; position < matchCountAtRound; position += 1) {
          const parent = parentRoundMatches[Math.floor(position / 2)] as
            TournamentMatch | undefined;
          const firstRoundMatch = round === 1 ? firstRound[position] : null;
          // A bye match is already won by its sole player.
          const winnerId = firstRoundMatch?.isBye
            ? (firstRoundMatch.player1Id ?? firstRoundMatch.player2Id)
            : null;

          const created = await transaction.match.create({
            data: {
              tournamentId,
              round,
              position,
              player1Id: firstRoundMatch?.player1Id ?? null,
              player2Id: firstRoundMatch?.player2Id ?? null,
              isBye: firstRoundMatch?.isBye ?? false,
              winnerId: winnerId ?? undefined,
              status: winnerId ? "VALIDATED" : "PENDING",
              nextMatchId: parent?.id,
              nextSlot: parent ? (position % 2) + 1 : undefined,
            },
          });

          currentRoundMatches.push({
            id: created.id,
            round,
            position,
            player1Id: created.player1Id,
            player2Id: created.player2Id,
            winnerId: created.winnerId,
            isBye: created.isBye,
            nextMatchId: created.nextMatchId,
            nextSlot: created.nextSlot,
          });
        }

        allMatches.push(...currentRoundMatches);
        parentRoundMatches = currentRoundMatches;
      }

      // Byes are decided immediately: advance their winner into the slot
      // they already occupy in the following round.
      const firstRoundResults = parentRoundMatches;
      for (const match of firstRoundResults) {
        if (!match.isBye || match.nextMatchId === null) {
          continue;
        }

        const field = match.nextSlot === 1 ? "player1Id" : "player2Id";
        const updated = await transaction.match.update({
          where: { id: match.nextMatchId },
          data: { [field]: match.winnerId },
        });
        // Keep the in-memory result returned to the caller in sync with
        // the update just persisted.
        const nextMatch = allMatches.find((m) => m.id === match.nextMatchId);

        if (nextMatch) {
          nextMatch.player1Id = updated.player1Id;
          nextMatch.player2Id = updated.player2Id;
        }
      }

      // Records the draw as a single audit entry, keeping a trace of the
      // previous bracket's size when this is a regeneration.
      await transaction.auditLog.create({
        data: {
          tournamentId,
          actorId,
          action: "DRAW",
          entity: "Tournament",
          entityId: tournamentId,
          before:
            matchCountBefore > 0 ? { matchCount: matchCountBefore } : undefined,
          after: { matchCount: allMatches.length, roundCount },
        },
      });

      return allMatches;
    });
  }

  /** Activates a drawn tournament and records the action atomically. */
  async activate(
    tournamentId: string,
    actorId: string,
  ): Promise<TournamentSummary> {
    return prisma.$transaction(async (transaction) => {
      const tournament = await transaction.tournament.findUnique({
        where: { id: tournamentId },
        select: {
          id: true,
          name: true,
          startDate: true,
          status: true,
          finalSetSuperTiebreak: true,
          matches: { select: { id: true }, take: 1 },
        },
      });

      if (!tournament) {
        throw new NotFoundError("Tournoi introuvable.");
      }

      guardActivation(tournament.status, tournament.matches.length > 0);

      const activated = await transaction.tournament.update({
        where: { id: tournamentId },
        data: { status: "IN_PROGRESS" },
        select: {
          id: true,
          name: true,
          startDate: true,
          status: true,
          finalSetSuperTiebreak: true,
        },
      });

      await transaction.auditLog.create({
        data: {
          tournamentId,
          actorId,
          action: "ACTIVATE",
          entity: "Tournament",
          entityId: tournamentId,
          before: { status: tournament.status },
          after: { status: activated.status },
        },
      });

      return activated;
    });
  }
}
