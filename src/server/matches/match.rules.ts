import type { MatchStatus } from "@/generated/prisma/enums";
import { ConflictError } from "@/server/errors/app-error";

export function guardMatchScheduling(
  status: MatchStatus,
  isBye: boolean,
): void {
  if (isBye || status !== "PENDING") {
    throw new ConflictError(
      "Seuls les matchs en attente peuvent être planifiés.",
    );
  }
}
