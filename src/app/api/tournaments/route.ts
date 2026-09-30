import { Role } from "@/generated/prisma/enums";
import { requireUserWithRole } from "@/server/auth/authorization";
import { BadRequestError } from "@/server/errors/app-error";
import { handleError } from "@/server/errors/handle-error";
import { PrismaTournamentRepository } from "@/server/tournaments/tournament.repository";
import { TournamentService } from "@/server/tournaments/tournament.service";

const tournamentService = new TournamentService(
  new PrismaTournamentRepository(),
);

export async function GET(request: Request): Promise<Response> {
  try {
    await requireUserWithRole([Role.ADMIN, Role.MEMBER]);
    const query = Object.fromEntries(new URL(request.url).searchParams);
    const tournaments = await tournamentService.list(query);

    return Response.json(tournaments);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    await requireUserWithRole([Role.ADMIN]);

    let input: unknown;

    try {
      input = await request.json();
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new BadRequestError();
      }

      throw error;
    }

    const tournament = await tournamentService.create(input);

    return Response.json(tournament, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
