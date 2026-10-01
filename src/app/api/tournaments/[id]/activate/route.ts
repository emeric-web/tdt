import { Role } from "@/generated/prisma/enums";
import { requireUserWithRole } from "@/server/auth/authorization";
import { handleError } from "@/server/errors/handle-error";
import { PrismaTournamentRepository } from "@/server/tournaments/tournament.repository";
import { TournamentService } from "@/server/tournaments/tournament.service";

const tournamentService = new TournamentService(
  new PrismaTournamentRepository(),
);

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  _request: Request,
  { params }: RouteContext,
): Promise<Response> {
  try {
    const user = await requireUserWithRole([Role.ADMIN]);
    const { id } = await params;

    return Response.json(await tournamentService.activate(id, user.id));
  } catch (error) {
    return handleError(error);
  }
}
