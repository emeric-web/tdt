import type {
  TournamentRepository,
  TournamentPage,
  TournamentSummary,
} from "@/server/tournaments/tournament.repository";
import {
  createTournamentSchema,
  listTournamentsSchema,
} from "@/server/tournaments/tournament.schemas";

export class TournamentService {
  constructor(private readonly repository: TournamentRepository) {}

  list(input: unknown = {}): Promise<TournamentPage> {
    const query = listTournamentsSchema.parse(input);

    return this.repository.findPage(query);
  }

  async create(input: unknown): Promise<TournamentSummary> {
    const tournament = createTournamentSchema.parse(input);

    return this.repository.create(tournament);
  }
}
