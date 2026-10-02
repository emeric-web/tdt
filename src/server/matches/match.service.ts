import type {
  MatchRepository,
  ScheduledMatch,
} from "@/server/matches/match.repository";
import { scheduleMatchSchema } from "@/server/matches/match.schemas";

export class MatchService {
  constructor(private readonly repository: MatchRepository) {}

  /** Validates and saves the schedule of a match. */
  schedule(id: string, input: unknown): Promise<ScheduledMatch> {
    const schedule = scheduleMatchSchema.parse(input);

    return this.repository.schedule(id, schedule);
  }
}
