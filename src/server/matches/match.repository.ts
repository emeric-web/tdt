import type { Match } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import { NotFoundError } from "@/server/errors/app-error";
import type { ScheduleMatchInput } from "@/server/matches/match.schemas";
import { guardMatchScheduling } from "@/server/matches/match.rules";

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

export interface MatchRepository {
  schedule(id: string, data: ScheduleMatchInput): Promise<ScheduledMatch>;
}

export class PrismaMatchRepository implements MatchRepository {
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
}
