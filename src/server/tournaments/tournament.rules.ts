import type { TournamentStatus } from "@/generated/prisma/enums";
import { ConflictError } from "@/server/errors/app-error";

export function guardParticipantsMutation(status: TournamentStatus): void {
  if (status !== "DRAFT") {
    throw new ConflictError(
      "Les inscriptions et têtes de série ne peuvent être modifiées qu'en préparation.",
    );
  }
}

export function guardActivation(
  status: TournamentStatus,
  hasDraw: boolean,
): void {
  if (status !== "DRAFT") {
    throw new ConflictError(
      "Le tournoi ne peut être activé que pendant sa préparation.",
    );
  }

  if (!hasDraw) {
    throw new ConflictError(
      "Le tournoi doit avoir un tableau avant de pouvoir être activé.",
    );
  }
}

export function guardDraw(status: TournamentStatus): void {
  if (status !== "DRAFT") {
    throw new ConflictError(
      "Le tableau ne peut être généré ou régénéré que pendant la préparation du tournoi.",
    );
  }
}
