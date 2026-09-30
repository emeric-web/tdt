import { Role } from "@/generated/prisma/enums";
import { requireUserWithRole } from "@/server/auth/authorization";
import { BadRequestError } from "@/server/errors/app-error";
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
    await requireUserWithRole([Role.ADMIN]);
    const { id } = await params;

    return Response.json(await tournamentService.listParticipants(id));
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(
  request: Request,
  { params }: RouteContext,
): Promise<Response> {
  try {
    await requireUserWithRole([Role.ADMIN]);
    const { id } = await params;

    let input: unknown;

    try {
      input = await request.json();
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new BadRequestError();
      }

      throw error;
    }

    return Response.json(await tournamentService.addParticipant(id, input), {
      status: 201,
    });
  } catch (error) {
    return handleError(error);
  }
}
