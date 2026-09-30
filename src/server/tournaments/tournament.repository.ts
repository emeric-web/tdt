import type { Tournament } from "@/generated/prisma/client";
import type { TournamentStatus } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import { ConflictError, NotFoundError } from "@/server/errors/app-error";
import { guardParticipantsMutation } from "@/server/tournaments/tournament.rules";

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
  items: TournamentParticipant[];
};

export interface TournamentRepository {
  findPage(input: {
    status?: TournamentStatus;
    page: number;
    pageSize: number;
  }): Promise<TournamentPage>;
  create(data: CreateTournamentData): Promise<TournamentSummary>;
  listParticipants(tournamentId: string): Promise<TournamentParticipants>;
  addParticipant(
    tournamentId: string,
    data: { userId: string; seed?: number },
  ): Promise<TournamentParticipant>;
  updateParticipantSeed(
    tournamentId: string,
    participantId: string,
    seed: number | null,
  ): Promise<TournamentParticipant>;
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
      canEdit: tournament.status === "DRAFT" && tournament.matches.length === 0,
      items: tournament.participants.map(({ user, ...participant }) => ({
        ...participant,
        name: user.name,
      })),
    };
  }

  /**
   * Registers a member as a participant, guarding against tournaments that
   * are no longer editable and against duplicate registrations or seeds.
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

        guardParticipantsMutation(
          tournament.status,
          tournament.matches.length > 0,
        );

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
   * Updates or clears a participant's seed, guarding against tournaments
   * that are no longer editable and against duplicate seeds.
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

        guardParticipantsMutation(
          tournament.status,
          tournament.matches.length > 0,
        );

        const participant = await transaction.participant.findFirst({
          where: { id: participantId, tournamentId },
          select: { id: true },
        });

        if (!participant) {
          throw new NotFoundError("Participant introuvable dans ce tournoi.");
        }

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
}
