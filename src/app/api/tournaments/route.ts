import { PrismaTournamentRepository } from "@/server/tournaments/tournament.repository";
import { TournamentService } from "@/server/tournaments/tournament.service";
import { handleError } from "@/server/errors/handle-error";

const tournamentService = new TournamentService(
  new PrismaTournamentRepository(),
);

export async function GET(): Promise<Response> {
  try {
    const tournaments = await tournamentService.list();

    return Response.json(tournaments);
  } catch (error) {
    return handleError(error);
  }
}
