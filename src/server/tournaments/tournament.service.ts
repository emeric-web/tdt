import type {
  TournamentRepository,
  TournamentSummary,
} from "@/server/tournaments/tournament.repository";

export class TournamentService {
  constructor(private readonly repository: TournamentRepository) {}

  list(): Promise<TournamentSummary[]> {
    return this.repository.findAll();
  }
}
