import type { MemberPage, ParticipantsResult } from "./participants.type";

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
