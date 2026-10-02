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

export async function GET(
  _request: Request,
  { params }: RouteContext,
): Promise<Response> {
  try {
    await requireUserWithRole();
    const { id } = await params;

    return Response.json(await tournamentService.getBracket(id));
  } catch (error) {
    return handleError(error);
  }
}
