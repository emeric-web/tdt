import type {
  MemberPage,
  ParticipantsResult,
  TournamentMatchResult,
} from "./participants.type";
import type { BracketData, MatchDto } from "@/types/bracket";

export function isErrorResponse(result: unknown): result is {
  error: { message: string };
} {
  return (
    typeof result === "object" &&
    result !== null &&
    "error" in result &&
    typeof result.error === "object" &&
    result.error !== null &&
    "message" in result.error &&
    typeof result.error.message === "string"
  );
}

export function isParticipantsResult(
  result: unknown,
): result is ParticipantsResult {
  return (
    typeof result === "object" &&
    result !== null &&
    "status" in result &&
    (result.status === "DRAFT" ||
      result.status === "IN_PROGRESS" ||
      result.status === "FINISHED") &&
    "canEdit" in result &&
    typeof result.canEdit === "boolean" &&
    "hasDraw" in result &&
    typeof result.hasDraw === "boolean" &&
    "items" in result &&
    Array.isArray(result.items) &&
    result.items.every(
      (participant) =>
        typeof participant === "object" &&
        participant !== null &&
        "id" in participant &&
        typeof participant.id === "string" &&
        "userId" in participant &&
        typeof participant.userId === "string" &&
        "name" in participant &&
        typeof participant.name === "string" &&
        "seed" in participant &&
        (typeof participant.seed === "number" || participant.seed === null),
    )
  );
}

export function isTournamentMatchResult(
  result: unknown,
): result is TournamentMatchResult[] {
  return (
    Array.isArray(result) &&
    result.every(
      (match) =>
        typeof match === "object" &&
        match !== null &&
        "id" in match &&
        typeof match.id === "string" &&
        "round" in match &&
        typeof match.round === "number" &&
        "position" in match &&
        typeof match.position === "number" &&
        "player1Id" in match &&
        (typeof match.player1Id === "string" || match.player1Id === null) &&
        "player2Id" in match &&
        (typeof match.player2Id === "string" || match.player2Id === null) &&
        "winnerId" in match &&
        (typeof match.winnerId === "string" || match.winnerId === null) &&
        "isBye" in match &&
        typeof match.isBye === "boolean" &&
        "nextMatchId" in match &&
        (typeof match.nextMatchId === "string" || match.nextMatchId === null) &&
        "nextSlot" in match &&
        (typeof match.nextSlot === "number" || match.nextSlot === null),
    )
  );
}

function isBracketMatch(result: unknown): result is MatchDto {
  return (
    typeof result === "object" &&
    result !== null &&
    "id" in result &&
    typeof result.id === "string" &&
    "round" in result &&
    typeof result.round === "number" &&
    "position" in result &&
    typeof result.position === "number" &&
    "player1" in result &&
    (result.player1 === null ||
      (typeof result.player1 === "object" &&
        result.player1 !== null &&
        "id" in result.player1 &&
        typeof result.player1.id === "string" &&
        "name" in result.player1 &&
        typeof result.player1.name === "string")) &&
    "player2" in result &&
    (result.player2 === null ||
      (typeof result.player2 === "object" &&
        result.player2 !== null &&
        "id" in result.player2 &&
        typeof result.player2.id === "string" &&
        "name" in result.player2 &&
        typeof result.player2.name === "string")) &&
    "status" in result &&
    (result.status === "PENDING" ||
      result.status === "DECLARED" ||
      result.status === "CORRECTION_PROPOSED" ||
      result.status === "DISPUTED" ||
      result.status === "VALIDATED") &&
    "scoreStatus" in result &&
    (result.scoreStatus === "NONE" ||
      result.scoreStatus === "DECLARED" ||
      result.scoreStatus === "CORRECTION_PROPOSED" ||
      result.scoreStatus === "DISPUTED" ||
      result.scoreStatus === "VALIDATED") &&
    "winnerId" in result &&
    (typeof result.winnerId === "string" || result.winnerId === null) &&
    "declaredById" in result &&
    (typeof result.declaredById === "string" || result.declaredById === null) &&
    "score" in result &&
    isScore(result.score) &&
    "proposedScore" in result &&
    isScore(result.proposedScore) &&
    "isBye" in result &&
    typeof result.isBye === "boolean" &&
    "scheduledAt" in result &&
    (typeof result.scheduledAt === "string" || result.scheduledAt === null) &&
    "court" in result &&
    (typeof result.court === "string" || result.court === null)
  );
}

function isScore(value: unknown): value is MatchDto["score"] {
  return (
    value === null ||
    (Array.isArray(value) &&
      value.length >= 2 &&
      value.length <= 3 &&
      value.every(
        (set) =>
          typeof set === "object" &&
          set !== null &&
          "p1" in set &&
          typeof set.p1 === "number" &&
          "p2" in set &&
          typeof set.p2 === "number" &&
          (!("tb" in set) || typeof set.tb === "number"),
      ))
  );
}

export function isBracketData(result: unknown): result is BracketData {
  return (
    typeof result === "object" &&
    result !== null &&
    "tournament" in result &&
    typeof result.tournament === "object" &&
    result.tournament !== null &&
    "id" in result.tournament &&
    typeof result.tournament.id === "string" &&
    "name" in result.tournament &&
    typeof result.tournament.name === "string" &&
    "startDate" in result.tournament &&
    (typeof result.tournament.startDate === "string" ||
      result.tournament.startDate === null) &&
    "finalSetSuperTiebreak" in result.tournament &&
    typeof result.tournament.finalSetSuperTiebreak === "boolean" &&
    "status" in result.tournament &&
    (result.tournament.status === "DRAFT" ||
      result.tournament.status === "IN_PROGRESS" ||
      result.tournament.status === "FINISHED") &&
    "rounds" in result &&
    Array.isArray(result.rounds) &&
    result.rounds.every(
      (round) =>
        typeof round === "object" &&
        round !== null &&
        "round" in round &&
        typeof round.round === "number" &&
        "matches" in round &&
        Array.isArray(round.matches) &&
        round.matches.every(isBracketMatch),
    )
  );
}

export function isMemberPage(result: unknown): result is MemberPage {
  return (
    typeof result === "object" &&
    result !== null &&
    "items" in result &&
    Array.isArray(result.items) &&
    "page" in result &&
    typeof result.page === "number" &&
    "pageSize" in result &&
    typeof result.pageSize === "number" &&
    "total" in result &&
    typeof result.total === "number" &&
    result.items.every(
      (member) =>
        typeof member === "object" &&
        member !== null &&
        "id" in member &&
        typeof member.id === "string" &&
        "name" in member &&
        typeof member.name === "string" &&
        "email" in member &&
        typeof member.email === "string",
    )
  );
}
