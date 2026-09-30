import type { Tournament } from "@/generated/prisma/client";
import type { TournamentStatus } from "@/generated/prisma/enums";
import { prisma } from "@/server/db/prisma";

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

export interface TournamentRepository {
  findPage(input: {
    status?: TournamentStatus;
    page: number;
    pageSize: number;
  }): Promise<TournamentPage>;
  create(data: CreateTournamentData): Promise<TournamentSummary>;
}

export class PrismaTournamentRepository implements TournamentRepository {
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
}
