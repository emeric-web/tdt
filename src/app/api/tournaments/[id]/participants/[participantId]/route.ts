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
  params: Promise<{ id: string; participantId: string }>;
};

export async function PATCH(
  request: Request,
  { params }: RouteContext,
): Promise<Response> {
  try {
    await requireUserWithRole([Role.ADMIN]);
    const { id, participantId } = await params;

    let input: unknown;

    try {
      input = await request.json();
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new BadRequestError();
      }

      throw error;
    }

    return Response.json(
      await tournamentService.updateParticipantSeed(id, participantId, input),
    );
  } catch (error) {
    return handleError(error);
  }
}
