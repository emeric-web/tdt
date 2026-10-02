import type { MatchStatus, TournamentStatus } from "@/generated/prisma/enums";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
} from "@/server/errors/app-error";

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

export function guardMatchDeclaration(
  status: MatchStatus,
  isBye: boolean,
  tournamentStatus: TournamentStatus,
  player1Id: string | null,
  player2Id: string | null,
  actorId: string,
): void {
  if (tournamentStatus !== "IN_PROGRESS" || isBye || status !== "PENDING") {
    throw new ConflictError("Ce match ne peut pas recevoir de résultat.");
  }

  if (actorId !== player1Id && actorId !== player2Id) {
    throw new ForbiddenError(
      "Seul un joueur de ce match peut déclarer le résultat.",
    );
  }
}

export function guardDeclaredWinner(
  winnerId: string,
  scoreWinnerId: string | null,
  player1Id: string | null,
  player2Id: string | null,
): void {
  if (winnerId !== player1Id && winnerId !== player2Id) {
    throw new BadRequestError(
      "Le vainqueur doit être l’un des joueurs du match.",
    );
  }

  if (winnerId !== scoreWinnerId) {
    throw new BadRequestError(
      "Le vainqueur indiqué ne correspond pas au score.",
    );
  }
}
