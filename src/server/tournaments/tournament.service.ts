import type {
  TournamentMatch,
  TournamentRepository,
  TournamentPage,
  TournamentParticipant,
  TournamentParticipants,
  TournamentSummary,
} from "@/server/tournaments/tournament.repository";
import {
  addParticipantSchema,
  createTournamentSchema,
  listTournamentsSchema,
  updateParticipantSeedSchema,
} from "@/server/tournaments/tournament.schemas";

export class TournamentService {
  constructor(private readonly repository: TournamentRepository) {}

  /** Validates the query and returns a paginated page of tournaments. */
  list(input: unknown = {}): Promise<TournamentPage> {
    const query = listTournamentsSchema.parse(input);

    return this.repository.findPage(query);
  }

  /** Validates the payload and creates a new tournament. */
  async create(input: unknown): Promise<TournamentSummary> {
    const tournament = createTournamentSchema.parse(input);

    return this.repository.create(tournament);
  }

  /** Returns the participants registered for a tournament. */
  listParticipants(tournamentId: string): Promise<TournamentParticipants> {
    return this.repository.listParticipants(tournamentId);
  }

  /** Validates the payload and registers a new participant. */
  async addParticipant(
    tournamentId: string,
    input: unknown,
  ): Promise<TournamentParticipant> {
    const participant = addParticipantSchema.parse(input);

    return this.repository.addParticipant(tournamentId, participant);
  }

  /** Validates the payload and updates or clears a participant's seed. */
  async updateParticipantSeed(
    tournamentId: string,
    participantId: string,
    input: unknown,
  ): Promise<TournamentParticipant> {
    const { seed } = updateParticipantSeedSchema.parse(input);

    return this.repository.updateParticipantSeed(
      tournamentId,
      participantId,
      seed,
    );
  }

  /** Removes a participant from a tournament still in preparation. */
  removeParticipant(
    tournamentId: string,
    participantId: string,
  ): Promise<void> {
    return this.repository.removeParticipant(tournamentId, participantId);
  }

  /** Generates (or regenerates) the tournament's bracket for the given actor. */
  draw(tournamentId: string, actorId: string): Promise<TournamentMatch[]> {
    return this.repository.draw(tournamentId, actorId);
  }

  /** Activates the tournament after its draw. */
  activate(tournamentId: string, actorId: string): Promise<TournamentSummary> {
    return this.repository.activate(tournamentId, actorId);
  }
}
