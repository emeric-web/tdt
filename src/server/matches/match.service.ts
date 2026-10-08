import type {
  MatchRepository,
  MatchDetails,
  AdminMatchDetails,
  ArbitrationMatch,
  CorrectionMatch,
  ScheduledMatch,
  UpcomingMatch,
} from "@/server/matches/match.repository";
import {
  arbitrateResultSchema,
  arbitrateScoreSchema,
  contestScoreSchema,
  correctResultSchema,
  declareResultSchema,
  proposeCorrectionSchema,
  scheduleMatchSchema,
} from "@/server/matches/match.schemas";
import type {
  ArbitrateResultInput,
  ArbitrateScoreInput,
  CorrectResultInput,
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

  /** Returns one match with the declared score for an administrator. */
  getDetailsForAdmin(id: string): Promise<AdminMatchDetails> {
    return this.repository.getDetailsForAdmin(id);
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

  /** Lists unresolved results for administrator arbitration. */
  listForArbitration(): Promise<ArbitrationMatch[]> {
    return this.repository.listForArbitration();
  }

  /** Validates and records an administrative result decision. */
  arbitrate(
    id: string,
    actorId: string,
    input: unknown,
  ): Promise<DeclaredMatch> {
    const decision: ArbitrateResultInput = arbitrateResultSchema.parse(input);

    return this.repository.arbitrate(id, actorId, decision);
  }

  /** Validates and records an administrative score decision. */
  arbitrateScore(
    id: string,
    actorId: string,
    input: unknown,
  ): Promise<DeclaredMatch> {
    const decision: ArbitrateScoreInput = arbitrateScoreSchema.parse(input);

    return this.repository.arbitrateScore(id, actorId, decision);
  }

  /** Lists validated results that remain correctable while their tournament is active. */
  listForCorrection(): Promise<CorrectionMatch[]> {
    return this.repository.listForCorrection();
  }

  /** Validates and records an administrative correction to a validated result. */
  correctResult(
    id: string,
    actorId: string,
    input: unknown,
  ): Promise<DeclaredMatch> {
    const correction: CorrectResultInput = correctResultSchema.parse(input);

    return this.repository.correctResult(id, actorId, correction);
  }
}
