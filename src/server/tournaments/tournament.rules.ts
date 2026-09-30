import type { TournamentStatus } from "@/generated/prisma/enums";
import { ConflictError } from "@/server/errors/app-error";

export function guardParticipantsMutation(
  status: TournamentStatus,
  hasDraw: boolean,
): void {
  if (status !== "DRAFT") {
    throw new ConflictError(
      "Les inscriptions et têtes de série ne peuvent être modifiées qu'en préparation.",
    );
  }

  if (hasDraw) {
    throw new ConflictError(
      "Les inscriptions et têtes de série ne peuvent plus être modifiées après le tirage.",
    );
  }
}
