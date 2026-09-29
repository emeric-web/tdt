import type { Tournament } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";

export type TournamentSummary = Pick<
  Tournament,
  "id" | "name" | "startDate" | "status"
>;

export interface TournamentRepository {
  findAll(): Promise<TournamentSummary[]>;
}

export class PrismaTournamentRepository implements TournamentRepository {
  findAll(): Promise<TournamentSummary[]> {
    return prisma.tournament.findMany({
      select: {
        id: true,
        name: true,
        startDate: true,
        status: true,
      },
      orderBy: {
        name: "asc",
      },
    });
  }
}
