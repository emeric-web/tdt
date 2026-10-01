import type {
  MemberPage,
  ParticipantsResult,
  TournamentMatchResult,
} from "./participants.type";

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
