import type {
  MatchRepository,
  MatchDetails,
  ScheduledMatch,
  UpcomingMatch,
} from "@/server/matches/match.repository";
import {
  contestScoreSchema,
  declareResultSchema,
  proposeCorrectionSchema,
  scheduleMatchSchema,
} from "@/server/matches/match.schemas";
import type { DeclaredMatch } from "@/server/matches/match.repository";

export class MatchService {
  constructor(private readonly repository: MatchRepository) {}

  /** Lists the current player's pending upcoming matches. */
  listUpcomingForPlayer(playerId: string): Promise<UpcomingMatch[]> {
    return this.repository.listUpcomingForPlayer(playerId);
  }

  /** Returns one match and its public tournament settings. */
  getDetails(id: string): Promise<MatchDetails> {
    return this.repository.getDetails(id);
  }

  /** Validates and saves the schedule of a match. */
  schedule(id: string, input: unknown): Promise<ScheduledMatch> {
    const schedule = scheduleMatchSchema.parse(input);

    return this.repository.schedule(id, schedule);
  }

  /** Validates a result declaration before delegating it to the repository. */
  declare(id: string, actorId: string, input: unknown): Promise<DeclaredMatch> {
    const declaration = declareResultSchema.parse(input);

    return this.repository.declare(id, actorId, declaration);
  }

  /** Confirms an opponent's declared result. */
  confirm(id: string, actorId: string): Promise<DeclaredMatch> {
    return this.repository.confirm(id, actorId);
  }

  /** Validates and stores an opponent's proposed alternative result. */
  proposeCorrection(
    id: string,
    actorId: string,
    input: unknown,
  ): Promise<DeclaredMatch> {
    const correction = proposeCorrectionSchema.parse(input);

    return this.repository.proposeCorrection(id, actorId, correction);
  }

  /** Validates and delegates an opponent's score-only contest. */
  contestScore(
    id: string,
    actorId: string,
    input: unknown,
  ): Promise<DeclaredMatch> {
    const contest = contestScoreSchema.parse(input);

    return this.repository.contestScore(id, actorId, contest);
  }
}
