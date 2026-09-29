import { PrismaTournamentRepository } from "@/server/tournaments/tournament.repository";
import { TournamentService } from "@/server/tournaments/tournament.service";

const tournamentService = new TournamentService(
  new PrismaTournamentRepository(),
);

export async function GET(): Promise<Response> {
  const tournaments = await tournamentService.list();

  return Response.json(tournaments);
}
