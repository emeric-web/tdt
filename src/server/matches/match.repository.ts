import type { Match } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/server/errors/app-error";
import type {
  DeclareResultInput,
  ProposeCorrectionInput,
  ScheduleMatchInput,
} from "@/server/matches/match.schemas";
import {
  guardDeclaredWinner,
  guardMatchDeclaration,
  guardMatchConfirmation,
  guardMatchCorrectionProposal,
  guardMatchScheduling,
} from "@/server/matches/match.rules";
import { scoreSchema, validateScore } from "@/server/score/score.validator";
import { roundLabel } from "@/lib/bracket";
import type { SetScore } from "@/types/bracket";

function parseStoredScore(value: Prisma.JsonValue | null): SetScore[] | null {
  if (value === null) {
    return null;
  }

  const result = scoreSchema.safeParse(value);
  if (!result.success) {
    throw new Error("Le score enregistré du match a un format invalide.");
  }

  return result.data;
}

export type ScheduledMatch = Pick<
  Match,
  | "id"
  | "tournamentId"
  | "round"
  | "position"
  | "winnerId"
  | "declaredById"
  | "proposedWinnerId"
  | "scoreStatus"
  | "status"
  | "resultKind"
  | "score"
  | "proposedScore"
  | "isBye"
  | "scheduledAt"
  | "court"
>;

export type DeclaredMatch = Pick<
  Match,
  | "id"
  | "tournamentId"
  | "round"
  | "position"
  | "winnerId"
  | "declaredById"
  | "declaredWinnerId"
  | "declaredScore"
  | "proposedWinnerId"
  | "scoreStatus"
  | "status"
  | "resultKind"
  | "score"
  | "proposedScore"
  | "isBye"
  | "scheduledAt"
  | "court"
>;

export type UpcomingMatch = {
  id: string;
  tournamentId: string;
  tournamentName: string;
  roundLabel: string;
  round: number;
  playerName: string;
  opponentName: string;
  scheduledAt: string | null;
  court: string | null;
};

export type MatchDetails = {
  tournamentId: string;
  tournamentName: string;
  roundLabel: string;
  tournamentStatus: "DRAFT" | "IN_PROGRESS" | "FINISHED";
  finalSetSuperTiebreak: boolean;
  match: {
    id: string;
    round: number;
    position: number;
    player1: { id: string; name: string } | null;
    player2: { id: string; name: string } | null;
    status: Match["status"];
    scoreStatus: Match["scoreStatus"];
    winnerId: string | null;
    declaredById: string | null;
    declaredWinnerId: string | null;
    proposedWinnerId: string | null;
    score: SetScore[] | null;
    proposedScore: SetScore[] | null;
    isBye: boolean;
    scheduledAt: string | null;
    court: string | null;
  };
};

export interface MatchRepository {
  listUpcomingForPlayer(playerId: string): Promise<UpcomingMatch[]>;
  getDetails(id: string): Promise<MatchDetails>;
  schedule(id: string, data: ScheduleMatchInput): Promise<ScheduledMatch>;
  declare(
    id: string,
    actorId: string,
    data: DeclareResultInput,
  ): Promise<DeclaredMatch>;
  confirm(id: string, actorId: string): Promise<DeclaredMatch>;
  proposeCorrection(
    id: string,
    actorId: string,
    data: ProposeCorrectionInput,
  ): Promise<DeclaredMatch>;
}

export class PrismaMatchRepository implements MatchRepository {
  /** Returns the public details of a match and its tournament settings. */
  async getDetails(id: string): Promise<MatchDetails> {
    const match = await prisma.match.findUnique({
      where: { id },
      select: {
        id: true,
        tournamentId: true,
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
        score: true,
        proposedScore: true,
        isBye: true,
        scheduledAt: true,
        court: true,
        tournament: {
          select: {
            name: true,
            status: true,
            finalSetSuperTiebreak: true,
            matches: { select: { round: true } },
          },
        },
      },
    });

    if (!match) {
      throw new NotFoundError("Match introuvable.");
    }

    return {
      tournamentId: match.tournamentId,
      tournamentName: match.tournament.name,
      roundLabel: roundLabel(
        match.round,
        Math.max(...match.tournament.matches.map(({ round }) => round)),
      ),
      tournamentStatus: match.tournament.status,
      finalSetSuperTiebreak: match.tournament.finalSetSuperTiebreak,
      match: {
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
        score: parseStoredScore(match.score),
        proposedScore: parseStoredScore(match.proposedScore),
        isBye: match.isBye,
        scheduledAt: match.scheduledAt?.toISOString() ?? null,
        court: match.court,
      },
    };
  }

  /** Returns upcoming pending matches assigned to the current player. */
  async listUpcomingForPlayer(playerId: string): Promise<UpcomingMatch[]> {
    const matches = await prisma.match.findMany({
      where: {
        status: "PENDING",
        isBye: false,
        tournament: { status: "IN_PROGRESS" },
        player1Id: { not: null },
        player2Id: { not: null },
        OR: [{ player1Id: playerId }, { player2Id: playerId }],
        AND: [
          {
            OR: [{ scheduledAt: null }, { scheduledAt: { gte: new Date() } }],
          },
        ],
      },
      orderBy: [{ scheduledAt: { sort: "asc", nulls: "last" } }],
      select: {
        id: true,
        tournamentId: true,
        round: true,
        player1Id: true,
        player1: { select: { name: true } },
        player2: { select: { name: true } },
        tournament: {
          select: {
            name: true,
            matches: { select: { round: true } },
          },
        },
        scheduledAt: true,
        court: true,
      },
    });

    return matches.map((match) => {
      const opponent =
        match.player1Id === playerId ? match.player2 : match.player1;
      const player =
        match.player1Id === playerId ? match.player1 : match.player2;

      if (!opponent || !player) {
        throw new Error(
          `Match ${match.id} does not have both players assigned.`,
        );
      }
      const totalRounds = Math.max(
        ...match.tournament.matches.map(({ round }) => round),
      );

      return {
        id: match.id,
        tournamentId: match.tournamentId,
        tournamentName: match.tournament.name,
        round: match.round,
        roundLabel: roundLabel(match.round, totalRounds),
        playerName: player.name,
        opponentName: opponent.name,
        scheduledAt: match.scheduledAt?.toISOString() ?? null,
        court: match.court,
      };
    });
  }

  /** Schedules a pending match and returns its public match fields. */
  async schedule(
    id: string,
    data: ScheduleMatchInput,
  ): Promise<ScheduledMatch> {
    try {
      return await prisma.$transaction(async (transaction) => {
        const match = await transaction.match.findUnique({
          where: { id },
          select: { status: true, isBye: true },
        });

        if (!match) {
          throw new NotFoundError("Match introuvable.");
        }

        guardMatchScheduling(match.status, match.isBye);

        return transaction.match.update({
          where: { id },
          data: {
            scheduledAt: new Date(data.scheduledAt),
            court: data.court,
          },
          select: {
            id: true,
            tournamentId: true,
            round: true,
            position: true,
            winnerId: true,
            declaredById: true,
            proposedWinnerId: true,
            scoreStatus: true,
            status: true,
            resultKind: true,
            score: true,
            proposedScore: true,
            isBye: true,
            scheduledAt: true,
            court: true,
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundError("Match introuvable.");
      }

      throw error;
    }
  }

  /** Records a player's result proposal without validating or advancing it. */
  async declare(
    id: string,
    actorId: string,
    data: DeclareResultInput,
  ): Promise<DeclaredMatch> {
    return prisma.$transaction(async (transaction) => {
      const match = await transaction.match.findUnique({
        where: { id },
        select: {
          status: true,
          isBye: true,
          player1Id: true,
          player2Id: true,
          version: true,
          tournament: {
            select: { status: true, finalSetSuperTiebreak: true },
          },
        },
      });

      if (!match) {
        throw new NotFoundError("Match introuvable.");
      }

      guardMatchDeclaration(
        match.status,
        match.isBye,
        match.tournament.status,
        match.player1Id,
        match.player2Id,
        actorId,
      );

      const scoreWinner = validateScore(
        data.score,
        match.tournament.finalSetSuperTiebreak,
      );
      const scoreWinnerId =
        scoreWinner === "p1" ? match.player1Id : match.player2Id;
      guardDeclaredWinner(
        data.winnerId,
        scoreWinnerId,
        match.player1Id,
        match.player2Id,
      );

      const score = data.score.map((set) => ({
        p1: set.p1,
        p2: set.p2,
        ...(set.tb === undefined ? {} : { tb: set.tb }),
      }));
      const updated = await transaction.match.updateMany({
        where: {
          id,
          status: "PENDING",
          version: match.version,
          tournament: { status: "IN_PROGRESS" },
        },
        data: {
          declaredById: actorId,
          declaredWinnerId: data.winnerId,
          declaredScore: score,
          proposedWinnerId: data.winnerId,
          proposedScore: score,
          scoreStatus: "DECLARED",
          status: "DECLARED",
          version: { increment: 1 },
        },
      });

      if (updated.count !== 1) {
        throw new ConflictError(
          "Le match a changé. Rechargez le tableau avant de réessayer.",
        );
      }

      return transaction.match.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          tournamentId: true,
          round: true,
          position: true,
          winnerId: true,
          declaredById: true,
          declaredWinnerId: true,
          declaredScore: true,
          proposedWinnerId: true,
          scoreStatus: true,
          status: true,
          resultKind: true,
          score: true,
          proposedScore: true,
          isBye: true,
          scheduledAt: true,
          court: true,
        },
      });
    });
  }

  /** Confirms a declared result, advances its winner, and closes a validated final atomically. */
  async confirm(id: string, actorId: string): Promise<DeclaredMatch> {
    return prisma.$transaction(async (transaction) => {
      const match = await transaction.match.findUnique({
        where: { id },
        select: {
          id: true,
          tournamentId: true,
          round: true,
          position: true,
          status: true,
          scoreStatus: true,
          isBye: true,
          player1Id: true,
          player2Id: true,
          declaredById: true,
          declaredWinnerId: true,
          declaredScore: true,
          version: true,
          nextMatchId: true,
          nextSlot: true,
          tournament: {
            select: {
              status: true,
              finalSetSuperTiebreak: true,
              matches: {
                orderBy: [{ round: "desc" }, { position: "asc" }],
                take: 1,
                select: { id: true },
              },
            },
          },
        },
      });

      if (!match) {
        throw new NotFoundError("Match introuvable.");
      }

      guardMatchConfirmation(
        match.status,
        match.scoreStatus,
        match.isBye,
        match.tournament.status,
        match.player1Id,
        match.player2Id,
        match.declaredById,
        actorId,
      );

      if (!match.declaredWinnerId || match.declaredScore === null) {
        throw new ConflictError("Le résultat déclaré est incomplet.");
      }

      const score = parseStoredScore(match.declaredScore);
      if (score === null) {
        throw new ConflictError("Le résultat déclaré est incomplet.");
      }
      let scoreWinner: ReturnType<typeof validateScore>;
      try {
        scoreWinner = validateScore(
          score,
          match.tournament.finalSetSuperTiebreak,
        );
      } catch (error) {
        if (error instanceof BadRequestError) {
          throw new Error("Le score déclaré du match est invalide.", {
            cause: error,
          });
        }

        throw error;
      }
      const scoreWinnerId =
        scoreWinner === "p1" ? match.player1Id : match.player2Id;
      if (
        (match.declaredWinnerId !== match.player1Id &&
          match.declaredWinnerId !== match.player2Id) ||
        match.declaredWinnerId !== scoreWinnerId
      ) {
        throw new ConflictError(
          "Le résultat déclaré ne correspond plus aux joueurs du match.",
        );
      }

      const finalMatchId = match.tournament.matches[0]?.id;
      const isFinal = finalMatchId === match.id && match.nextMatchId === null;
      if (isFinal) {
        const unfinishedMatch = await transaction.match.findFirst({
          where: {
            tournamentId: match.tournamentId,
            id: { not: match.id },
            status: { not: "VALIDATED" },
          },
          select: { id: true },
        });
        if (unfinishedMatch) {
          throw new ConflictError(
            "Le tournoi contient encore des matchs non validés.",
          );
        }
      }

      const validated = await transaction.match.updateMany({
        where: {
          id: match.id,
          status: "DECLARED",
          scoreStatus: "DECLARED",
          version: match.version,
          declaredById: { not: actorId },
          tournament: { status: "IN_PROGRESS" },
        },
        data: {
          winnerId: match.declaredWinnerId,
          score,
          status: "VALIDATED",
          scoreStatus: "VALIDATED",
          version: { increment: 1 },
        },
      });

      if (validated.count !== 1) {
        throw new ConflictError(
          "Le match a changé. Rechargez la page avant de réessayer.",
        );
      }

      if (isFinal) {
        const finished = await transaction.tournament.updateMany({
          where: { id: match.tournamentId, status: "IN_PROGRESS" },
          data: { status: "FINISHED" },
        });
        if (finished.count !== 1) {
          throw new ConflictError(
            "Le tournoi a changé. Rechargez la page avant de réessayer.",
          );
        }
      } else {
        const nextMatchId = match.nextMatchId;
        const nextSlot = match.nextSlot;
        if (nextMatchId === null || (nextSlot !== 1 && nextSlot !== 2)) {
          throw new ConflictError(
            "Le match n’est pas relié au tour suivant du tableau.",
          );
        }

        const nextMatchWhere =
          nextSlot === 1
            ? { id: nextMatchId, status: "PENDING" as const, player1Id: null }
            : { id: nextMatchId, status: "PENDING" as const, player2Id: null };
        const nextMatchData =
          nextSlot === 1
            ? { player1Id: match.declaredWinnerId, version: { increment: 1 } }
            : { player2Id: match.declaredWinnerId, version: { increment: 1 } };
        const advanced = await transaction.match.updateMany({
          where: nextMatchWhere,
          data: nextMatchData,
        });

        if (advanced.count !== 1) {
          throw new ConflictError(
            "La place du vainqueur dans le tour suivant a changé.",
          );
        }
      }

      return transaction.match.findUniqueOrThrow({
        where: { id: match.id },
        select: {
          id: true,
          tournamentId: true,
          round: true,
          position: true,
          winnerId: true,
          declaredById: true,
          declaredWinnerId: true,
          declaredScore: true,
          proposedWinnerId: true,
          scoreStatus: true,
          status: true,
          resultKind: true,
          score: true,
          proposedScore: true,
          isBye: true,
          scheduledAt: true,
          court: true,
        },
      });
    });
  }

  /** Stores the opponent's alternative winner and score without advancing the bracket. */
  async proposeCorrection(
    id: string,
    actorId: string,
    data: ProposeCorrectionInput,
  ): Promise<DeclaredMatch> {
    return prisma.$transaction(async (transaction) => {
      const match = await transaction.match.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          scoreStatus: true,
          isBye: true,
          player1Id: true,
          player2Id: true,
          declaredById: true,
          declaredWinnerId: true,
          version: true,
          tournament: {
            select: { status: true, finalSetSuperTiebreak: true },
          },
        },
      });

      if (!match) {
        throw new NotFoundError("Match introuvable.");
      }

      guardMatchCorrectionProposal(
        match.status,
        match.scoreStatus,
        match.isBye,
        match.tournament.status,
        match.player1Id,
        match.player2Id,
        match.declaredById,
        match.declaredWinnerId,
        data.winnerId,
        actorId,
      );

      const scoreWinner = validateScore(
        data.score,
        match.tournament.finalSetSuperTiebreak,
      );
      const scoreWinnerId =
        scoreWinner === "p1" ? match.player1Id : match.player2Id;
      guardDeclaredWinner(
        data.winnerId,
        scoreWinnerId,
        match.player1Id,
        match.player2Id,
      );

      const score = data.score.map((set) => ({
        p1: set.p1,
        p2: set.p2,
        ...(set.tb === undefined ? {} : { tb: set.tb }),
      }));
      const updated = await transaction.match.updateMany({
        where: {
          id: match.id,
          status: "DECLARED",
          scoreStatus: "DECLARED",
          version: match.version,
          declaredById: match.declaredById,
          tournament: { status: "IN_PROGRESS" },
        },
        data: {
          proposedWinnerId: data.winnerId,
          proposedScore: score,
          status: "CORRECTION_PROPOSED",
          scoreStatus: "CORRECTION_PROPOSED",
          version: { increment: 1 },
        },
      });

      if (updated.count !== 1) {
        throw new ConflictError(
          "Le résultat a changé. Rechargez la page avant de réessayer.",
        );
      }

      return transaction.match.findUniqueOrThrow({
        where: { id: match.id },
        select: {
          id: true,
          tournamentId: true,
          round: true,
          position: true,
          winnerId: true,
          declaredById: true,
          declaredWinnerId: true,
          declaredScore: true,
          proposedWinnerId: true,
          scoreStatus: true,
          status: true,
          resultKind: true,
          score: true,
          proposedScore: true,
          isBye: true,
          scheduledAt: true,
          court: true,
        },
      });
    });
  }
}
