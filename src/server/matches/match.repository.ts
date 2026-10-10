import type { Match } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/server/errors/app-error";
import type {
  ArbitrateResultInput,
  ArbitrateScoreInput,
  ContestScoreInput,
  CorrectResultInput,
  DeclareResultInput,
  ProposeCorrectionInput,
  ScheduleMatchInput,
} from "@/server/matches/match.schemas";
import {
  guardDeclaredWinner,
  guardMatchDeclaration,
  guardMatchConfirmation,
  guardMatchCorrectionProposal,
  guardMatchArbitration,
  guardMatchScoreContest,
  guardMatchScheduling,
  guardValidatedResultCorrection,
} from "@/server/matches/match.rules";
import {
  persistedScoreSchema,
  validateAbandonScore,
  validateScore,
} from "@/server/score/score.validator";
import { roundLabel } from "@/lib/bracket";
import type { SetScore } from "@/types/bracket";

function parseStoredScore(value: Prisma.JsonValue | null): SetScore[] | null {
  if (value === null) {
    return null;
  }

  const result = persistedScoreSchema.safeParse(value);
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

type Player = { id: string; name: string };

type ResultStatus =
  | "PENDING"
  | "DECLARED"
  | "CORRECTION_PROPOSED"
  | "DISPUTED"
  | "VALIDATED";

type ResultKind = "NORMAL" | "ABANDON" | "FORFEIT" | "BYE";

export type MatchPageData = {
  id: string;
  tournament: {
    id: string;
    name: string;
    status: "DRAFT" | "IN_PROGRESS" | "FINISHED";
    finalSetSuperTiebreak: boolean;
  };
  players: [Player | null, Player | null];
  roundLabel: string;
  details: {
    scheduledAt: string | null;
    court: string | null;
    round: number;
    position: number;
  };
  result: {
    status: ResultStatus;
    kind: ResultKind | null;
    declared: {
      byId: string;
      winnerId: string;
      score: SetScore[];
    } | null;
    proposed: {
      winnerId: string;
      score: SetScore[];
    } | null;
    winnerId: string | null;
    score: SetScore[] | null;
  };
};

export type ArbitrationMatch = {
  id: string;
  tournamentId: string;
  tournamentName: string;
  round: number;
  position: number;
  status: Match["status"];
  scoreStatus: Match["scoreStatus"];
  declaredWinnerId: string | null;
  proposedWinnerId: string | null;
  declaredScore: SetScore[] | null;
  proposedScore: SetScore[] | null;
  player1: { id: string; name: string } | null;
  player2: { id: string; name: string } | null;
  finalSetSuperTiebreak: boolean;
};

export type CorrectionMatch = {
  id: string;
  tournamentId: string;
  tournamentName: string;
  round: number;
  position: number;
  winnerId: string;
  score: SetScore[] | null;
  resultKind: Match["resultKind"];
  player1: { id: string; name: string } | null;
  player2: { id: string; name: string } | null;
};

export interface MatchRepository {
  listUpcomingForPlayer(playerId: string): Promise<UpcomingMatch[]>;
  getMatchPageData(id: string): Promise<MatchPageData>;
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
  contestScore(
    id: string,
    actorId: string,
    data: ContestScoreInput,
  ): Promise<DeclaredMatch>;
  listForArbitration(): Promise<ArbitrationMatch[]>;
  arbitrate(
    id: string,
    actorId: string,
    data: ArbitrateResultInput,
  ): Promise<DeclaredMatch>;
  arbitrateScore(
    id: string,
    actorId: string,
    data: ArbitrateScoreInput,
  ): Promise<DeclaredMatch>;
  listForCorrection(): Promise<CorrectionMatch[]>;
  correctResult(
    id: string,
    actorId: string,
    data: CorrectResultInput,
  ): Promise<DeclaredMatch>;
}

type ArbitrationTransactionMatch = {
  id: string;
  tournamentId: string;
  round: number;
  position: number;
  status: Match["status"];
  scoreStatus: Match["scoreStatus"];
  isBye: boolean;
  player1Id: string | null;
  player2Id: string | null;
  winnerId: string | null;
  declaredById: string | null;
  declaredWinnerId: string | null;
  declaredScore: Prisma.JsonValue | null;
  proposedWinnerId: string | null;
  proposedScore: Prisma.JsonValue | null;
  score: Prisma.JsonValue | null;
  resultKind: Match["resultKind"];
  version: number;
  nextMatchId: string | null;
  nextSlot: number | null;
  tournament: {
    status: "DRAFT" | "IN_PROGRESS" | "FINISHED";
    finalSetSuperTiebreak: boolean;
    matches: { id: string }[];
  };
};

async function persistArbitration(
  transaction: Prisma.TransactionClient,
  match: ArbitrationTransactionMatch,
  actorId: string,
  winnerId: string,
  score: { p1: number; p2: number; tb?: number }[],
  resultKind: "NORMAL" | "ABANDON" | "FORFEIT",
  reason: string | undefined,
  action: "ARBITRATE" | "ARBITRATE_SCORE",
): Promise<DeclaredMatch> {
  const isFinal =
    match.tournament.matches[0]?.id === match.id && match.nextMatchId === null;

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

  const before = {
    status: match.status,
    scoreStatus: match.scoreStatus,
    winnerId: match.winnerId,
    declaredWinnerId: match.declaredWinnerId,
    declaredScore: match.declaredScore,
    proposedWinnerId: match.proposedWinnerId,
    proposedScore: match.proposedScore,
    score: match.score,
    resultKind: match.resultKind,
  };
  const storedScore = score.map((set) => ({
    p1: set.p1,
    p2: set.p2,
    ...(set.tb === undefined ? {} : { tb: set.tb }),
  }));
  const updated = await transaction.match.updateMany({
    where: {
      id: match.id,
      status: match.status,
      scoreStatus: match.scoreStatus,
      version: match.version,
      tournament: { status: "IN_PROGRESS" },
    },
    data: {
      winnerId,
      score: storedScore,
      proposedWinnerId: winnerId,
      proposedScore: storedScore,
      resultKind,
      status: "VALIDATED",
      scoreStatus: "VALIDATED",
      version: { increment: 1 },
    },
  });

  if (updated.count !== 1) {
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
    if (
      match.nextMatchId === null ||
      (match.nextSlot !== 1 && match.nextSlot !== 2)
    ) {
      throw new ConflictError(
        "Le match n’est pas relié au tour suivant du tableau.",
      );
    }

    const nextMatchWhere =
      match.nextSlot === 1
        ? {
            id: match.nextMatchId,
            status: "PENDING" as const,
            player1Id: null,
          }
        : {
            id: match.nextMatchId,
            status: "PENDING" as const,
            player2Id: null,
          };
    const nextMatchData =
      match.nextSlot === 1
        ? { player1Id: winnerId, version: { increment: 1 } }
        : { player2Id: winnerId, version: { increment: 1 } };
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

  await transaction.auditLog.create({
    data: {
      tournamentId: match.tournamentId,
      actorId,
      action,
      reason,
      entity: "Match",
      entityId: match.id,
      before,
      after: {
        status: "VALIDATED",
        scoreStatus: "VALIDATED",
        winnerId,
        proposedWinnerId: winnerId,
        score: storedScore,
        resultKind,
      },
    },
  });

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
}

export class PrismaMatchRepository implements MatchRepository {
  /** Returns the details of a match and its tournament settings. */
  async getMatchPageData(id: string): Promise<MatchPageData> {
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
        resultKind: true,
        winnerId: true,
        declaredById: true,
        declaredWinnerId: true,
        declaredScore: true,
        proposedWinnerId: true,
        score: true,
        proposedScore: true,
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

    const declaredScore = parseStoredScore(match.declaredScore);
    const proposedScore = parseStoredScore(match.proposedScore);

    return {
      id: match.id,
      tournament: {
        id: match.tournamentId,
        name: match.tournament.name,
        status: match.tournament.status,
        finalSetSuperTiebreak: match.tournament.finalSetSuperTiebreak,
      },
      players: [match.player1, match.player2],
      roundLabel: roundLabel(
        match.round,
        Math.max(...match.tournament.matches.map(({ round }) => round)),
      ),
      details: {
        scheduledAt: match.scheduledAt?.toISOString() ?? null,
        court: match.court,
        round: match.round,
        position: match.position,
      },
      result: {
        status: match.status,
        kind: match.resultKind,
        declared:
          match.declaredById !== null &&
          match.declaredWinnerId !== null &&
          declaredScore !== null
            ? {
                byId: match.declaredById,
                winnerId: match.declaredWinnerId,
                score: declaredScore,
              }
            : null,
        proposed:
          match.proposedWinnerId !== null && proposedScore !== null
            ? { winnerId: match.proposedWinnerId, score: proposedScore }
            : null,
        winnerId: match.winnerId,
        score: parseStoredScore(match.score),
      },
    };
  }

  /** Returns upcoming pending matches assigned to the current player. */
  async listUpcomingForPlayer(playerId: string): Promise<UpcomingMatch[]> {
    const matches = await prisma.match.findMany({
      where: {
        status: { not: "VALIDATED" },
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
          proposedWinnerId: true,
          proposedScore: true,
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

      const isCorrectionProposed =
        match.status === "CORRECTION_PROPOSED" &&
        match.scoreStatus === "CORRECTION_PROPOSED";
      const winnerToConfirm = isCorrectionProposed
        ? match.proposedWinnerId
        : match.declaredWinnerId;
      const scoreToConfirm = isCorrectionProposed
        ? match.proposedScore
        : match.declaredScore;

      if (!winnerToConfirm || scoreToConfirm === null) {
        throw new ConflictError("Le résultat déclaré est incomplet.");
      }

      const score = parseStoredScore(scoreToConfirm);
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
        (winnerToConfirm !== match.player1Id &&
          winnerToConfirm !== match.player2Id) ||
        winnerToConfirm !== scoreWinnerId
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
          status: match.status,
          scoreStatus: match.scoreStatus,
          version: match.version,
          ...(isCorrectionProposed
            ? { declaredById: actorId }
            : { declaredById: { not: actorId } }),
          tournament: { status: "IN_PROGRESS" },
        },
        data: {
          winnerId: winnerToConfirm,
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
            ? { player1Id: winnerToConfirm, version: { increment: 1 } }
            : { player2Id: winnerToConfirm, version: { increment: 1 } };
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

  /** Records an alternative score with the same winner and leaves the match unresolved. */
  async contestScore(
    id: string,
    actorId: string,
    data: ContestScoreInput,
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

      guardMatchScoreContest(
        match.status,
        match.scoreStatus,
        match.isBye,
        match.tournament.status,
        match.player1Id,
        match.player2Id,
        match.declaredById,
        actorId,
      );

      if (
        match.declaredWinnerId !== match.player1Id &&
        match.declaredWinnerId !== match.player2Id
      ) {
        throw new ConflictError(
          "Le vainqueur déclaré ne participe pas au match.",
        );
      }

      const scoreWinner = validateScore(
        data.score,
        match.tournament.finalSetSuperTiebreak,
      );
      const scoreWinnerId =
        scoreWinner === "p1" ? match.player1Id : match.player2Id;
      if (scoreWinnerId !== match.declaredWinnerId) {
        throw new BadRequestError(
          "Le score contesté doit conserver le vainqueur déclaré.",
        );
      }

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
          declaredWinnerId: match.declaredWinnerId,
          tournament: { status: "IN_PROGRESS" },
        },
        data: {
          proposedWinnerId: match.declaredWinnerId,
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

  /** Returns unresolved match results for the administrator's arbitration queue. */
  async listForArbitration(): Promise<ArbitrationMatch[]> {
    const matches = await prisma.match.findMany({
      where: {
        status: { in: ["DECLARED", "CORRECTION_PROPOSED", "DISPUTED"] },
        tournament: { status: "IN_PROGRESS" },
        isBye: false,
      },
      orderBy: [
        { tournament: { name: "asc" } },
        { round: "desc" },
        { position: "asc" },
      ],
      select: {
        id: true,
        tournamentId: true,
        round: true,
        position: true,
        status: true,
        scoreStatus: true,
        declaredWinnerId: true,
        proposedWinnerId: true,
        declaredScore: true,
        proposedScore: true,
        player1: { select: { id: true, name: true } },
        player2: { select: { id: true, name: true } },
        tournament: {
          select: {
            name: true,
            finalSetSuperTiebreak: true,
          },
        },
      },
    });

    return matches.map((match) => ({
      id: match.id,
      tournamentId: match.tournamentId,
      tournamentName: match.tournament.name,
      round: match.round,
      position: match.position,
      status: match.status,
      scoreStatus: match.scoreStatus,
      declaredWinnerId: match.declaredWinnerId,
      proposedWinnerId: match.proposedWinnerId,
      declaredScore: parseStoredScore(match.declaredScore),
      proposedScore: parseStoredScore(match.proposedScore),
      player1: match.player1,
      player2: match.player2,
      finalSetSuperTiebreak: match.tournament.finalSetSuperTiebreak,
    }));
  }

  /** Resolves a disputed result, advances the winner, and logs the decision atomically. */
  async arbitrate(
    id: string,
    actorId: string,
    data: ArbitrateResultInput,
  ): Promise<DeclaredMatch> {
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
          winnerId: true,
          declaredById: true,
          declaredWinnerId: true,
          declaredScore: true,
          proposedWinnerId: true,
          proposedScore: true,
          score: true,
          resultKind: true,
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

      guardMatchArbitration(
        match.status,
        match.scoreStatus,
        match.isBye,
        match.tournament.status,
        match.player1Id,
        match.player2Id,
      );

      if (
        data.winnerId !== match.player1Id &&
        data.winnerId !== match.player2Id
      ) {
        throw new BadRequestError(
          "Le vainqueur doit être l’un des joueurs du match.",
        );
      }

      if (data.resultKind === "NORMAL") {
        const scoreWinner = validateScore(
          data.score,
          match.tournament.finalSetSuperTiebreak,
        );
        const scoreWinnerId =
          scoreWinner === "p1" ? match.player1Id : match.player2Id;
        if (scoreWinnerId !== data.winnerId) {
          throw new BadRequestError(
            "Le vainqueur indiqué ne correspond pas au score.",
          );
        }
      } else if (data.resultKind === "ABANDON") {
        validateAbandonScore(
          data.score,
          match.tournament.finalSetSuperTiebreak,
        );
      } else if (data.score.length !== 0) {
        throw new BadRequestError(
          "Un forfait ne peut pas comporter de score sportif.",
        );
      }

      return persistArbitration(
        transaction,
        match,
        actorId,
        data.winnerId,
        data.score,
        data.resultKind,
        data.reason,
        "ARBITRATE",
      );
    });
  }

  /** Resolves a score dispute, validates its winner, advances it, and logs the decision atomically. */
  async arbitrateScore(
    id: string,
    actorId: string,
    data: ArbitrateScoreInput,
  ): Promise<DeclaredMatch> {
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
          winnerId: true,
          declaredById: true,
          declaredWinnerId: true,
          declaredScore: true,
          proposedWinnerId: true,
          proposedScore: true,
          score: true,
          resultKind: true,
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

      guardMatchArbitration(
        match.status,
        match.scoreStatus,
        match.isBye,
        match.tournament.status,
        match.player1Id,
        match.player2Id,
      );

      const winnerId = match.proposedWinnerId ?? match.declaredWinnerId;
      if (
        winnerId === null ||
        (winnerId !== match.player1Id && winnerId !== match.player2Id)
      ) {
        throw new ConflictError(
          "Le vainqueur proposé ne participe pas au match.",
        );
      }

      if (data.resultKind === "NORMAL") {
        const scoreWinner = validateScore(
          data.score,
          match.tournament.finalSetSuperTiebreak,
        );
        const scoreWinnerId =
          scoreWinner === "p1" ? match.player1Id : match.player2Id;
        if (scoreWinnerId !== winnerId) {
          throw new BadRequestError(
            "Le score arbitré ne correspond pas au vainqueur proposé.",
          );
        }
      } else {
        validateAbandonScore(
          data.score,
          match.tournament.finalSetSuperTiebreak,
        );
      }

      return persistArbitration(
        transaction,
        match,
        actorId,
        winnerId,
        data.score,
        data.resultKind,
        data.reason,
        "ARBITRATE_SCORE",
      );
    });
  }

  /** Lists validated results in active tournaments that can still be corrected. */
  async listForCorrection(): Promise<CorrectionMatch[]> {
    const matches = await prisma.match.findMany({
      where: {
        status: "VALIDATED",
        scoreStatus: "VALIDATED",
        isBye: false,
        tournament: { status: "IN_PROGRESS" },
        winnerId: { not: null },
      },
      orderBy: [
        { tournament: { name: "asc" } },
        { round: "desc" },
        { position: "asc" },
      ],
      select: {
        id: true,
        tournamentId: true,
        round: true,
        position: true,
        winnerId: true,
        score: true,
        resultKind: true,
        player1: { select: { id: true, name: true } },
        player2: { select: { id: true, name: true } },
        tournament: { select: { name: true } },
      },
    });

    return matches.map((match) => {
      if (match.winnerId === null) {
        throw new Error(`Validated match ${match.id} has no winner.`);
      }

      return {
        id: match.id,
        tournamentId: match.tournamentId,
        tournamentName: match.tournament.name,
        round: match.round,
        position: match.position,
        winnerId: match.winnerId,
        score: parseStoredScore(match.score),
        resultKind: match.resultKind,
        player1: match.player1,
        player2: match.player2,
      };
    });
  }

  /** Corrects a validated result and, if necessary, replaces its downstream slot. */
  async correctResult(
    id: string,
    actorId: string,
    data: CorrectResultInput,
  ): Promise<DeclaredMatch> {
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
          winnerId: true,
          declaredById: true,
          declaredWinnerId: true,
          declaredScore: true,
          proposedWinnerId: true,
          proposedScore: true,
          score: true,
          resultKind: true,
          version: true,
          nextMatchId: true,
          nextSlot: true,
          tournament: {
            select: { status: true, finalSetSuperTiebreak: true },
          },
        },
      });

      if (!match) {
        throw new NotFoundError("Match introuvable.");
      }

      guardValidatedResultCorrection(
        match.status,
        match.scoreStatus,
        match.isBye,
        match.tournament.status,
        match.winnerId,
        match.player1Id,
        match.player2Id,
      );

      const winnerId = data.winnerId ?? match.winnerId;
      const storedScore = parseStoredScore(match.score);
      const score = data.score ?? storedScore;
      if (score === null) {
        throw new ConflictError(
          "Le score doit être fourni pour corriger un résultat sans score.",
        );
      }
      const resultKind = data.resultKind ?? match.resultKind ?? "NORMAL";

      if (resultKind === "NORMAL") {
        const scoreWinner = validateScore(
          score,
          match.tournament.finalSetSuperTiebreak,
        );
        const scoreWinnerId =
          scoreWinner === "p1" ? match.player1Id : match.player2Id;
        if (winnerId !== scoreWinnerId) {
          throw new BadRequestError(
            "Le vainqueur corrigé ne correspond pas au score.",
          );
        }
      } else if (resultKind === "ABANDON") {
        validateAbandonScore(score, match.tournament.finalSetSuperTiebreak);
      } else if (score.length !== 0) {
        throw new BadRequestError(
          "Un forfait ne peut pas comporter de score sportif.",
        );
      }

      const winnerChanged = winnerId !== match.winnerId;
      const scoreChanged =
        JSON.stringify(score) !== JSON.stringify(storedScore);
      const kindChanged = resultKind !== (match.resultKind ?? "NORMAL");
      if (!winnerChanged && !scoreChanged && !kindChanged) {
        throw new BadRequestError(
          "La correction ne modifie pas le résultat existant.",
        );
      }

      if (winnerChanged && match.nextMatchId !== null) {
        if (match.nextSlot !== 1 && match.nextSlot !== 2) {
          throw new ConflictError(
            "Le match n’est pas relié correctement au tour suivant.",
          );
        }

        const nextSlotField = match.nextSlot === 1 ? "player1Id" : "player2Id";
        const advanced = await transaction.match.updateMany({
          where: {
            id: match.nextMatchId,
            status: "PENDING",
            [nextSlotField]: match.winnerId,
          },
          data: {
            [nextSlotField]: winnerId,
            version: { increment: 1 },
          },
        });

        if (advanced.count !== 1) {
          throw new ConflictError(
            "Le match suivant a déjà commencé ou le vainqueur corrigé n’y figure plus.",
          );
        }
      }

      const before = {
        winnerId: match.winnerId,
        score: match.score,
        resultKind: match.resultKind,
        status: match.status,
        scoreStatus: match.scoreStatus,
      };
      const updated = await transaction.match.updateMany({
        where: {
          id: match.id,
          status: "VALIDATED",
          scoreStatus: "VALIDATED",
          version: match.version,
          tournament: { status: "IN_PROGRESS" },
        },
        data: {
          winnerId,
          proposedWinnerId: winnerId,
          score,
          proposedScore: score,
          resultKind,
          version: { increment: 1 },
        },
      });

      if (updated.count !== 1) {
        throw new ConflictError(
          "Le résultat a changé. Rechargez la page avant de réessayer.",
        );
      }

      await transaction.auditLog.create({
        data: {
          tournamentId: match.tournamentId,
          actorId,
          action: "CORRECT_RESULT",
          reason: data.reason,
          entity: "Match",
          entityId: match.id,
          before,
          after: {
            winnerId,
            score,
            resultKind,
            status: "VALIDATED",
            scoreStatus: "VALIDATED",
          },
        },
      });

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
