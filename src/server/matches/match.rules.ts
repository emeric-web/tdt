import type {
  MatchStatus,
  ScoreStatus,
  TournamentStatus,
} from "@/generated/prisma/enums";
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

export function guardMatchConfirmation(
  status: MatchStatus,
  scoreStatus: ScoreStatus,
  isBye: boolean,
  tournamentStatus: TournamentStatus,
  player1Id: string | null,
  player2Id: string | null,
  declaredById: string | null,
  actorId: string,
): void {
  const isDeclared = status === "DECLARED" && scoreStatus === "DECLARED";
  const isCorrectionProposed =
    status === "CORRECTION_PROPOSED" &&
    scoreStatus === "CORRECTION_PROPOSED";

  if (
    tournamentStatus !== "IN_PROGRESS" ||
    isBye ||
    (!isDeclared && !isCorrectionProposed) ||
    declaredById === null
  ) {
    throw new ConflictError("Ce résultat ne peut pas être confirmé.");
  }

  if (declaredById !== player1Id && declaredById !== player2Id) {
    throw new ConflictError(
      "Le résultat a été déclaré par un joueur qui ne participe pas au match.",
    );
  }

  if (actorId !== player1Id && actorId !== player2Id) {
    throw new ForbiddenError(
      "Seul l’adversaire peut confirmer le résultat de ce match.",
    );
  }

  if (isDeclared && actorId === declaredById) {
    throw new ForbiddenError(
      "Le joueur ayant déclaré le résultat ne peut pas le confirmer.",
    );
  }

  if (isCorrectionProposed && actorId !== declaredById) {
    throw new ForbiddenError(
      "Seul le joueur ayant déclaré le résultat initial peut confirmer la correction.",
    );
  }
}

export function guardMatchCorrectionProposal(
  status: MatchStatus,
  scoreStatus: ScoreStatus,
  isBye: boolean,
  tournamentStatus: TournamentStatus,
  player1Id: string | null,
  player2Id: string | null,
  declaredById: string | null,
  declaredWinnerId: string | null,
  proposedWinnerId: string,
  actorId: string,
): void {
  if (
    tournamentStatus !== "IN_PROGRESS" ||
    isBye ||
    status !== "DECLARED" ||
    scoreStatus !== "DECLARED" ||
    declaredById === null ||
    declaredWinnerId === null
  ) {
    throw new ConflictError(
      "Ce résultat ne peut plus recevoir de proposition de correction.",
    );
  }

  if (declaredById !== player1Id && declaredById !== player2Id) {
    throw new ConflictError(
      "Le résultat a été déclaré par un joueur qui ne participe pas au match.",
    );
  }

  if (actorId !== player1Id && actorId !== player2Id) {
    throw new ForbiddenError(
      "Seul un joueur de ce match peut proposer une correction.",
    );
  }

  if (actorId === declaredById) {
    throw new ForbiddenError(
      "Seul l’adversaire ayant reçu la déclaration peut proposer une correction.",
    );
  }

  if (declaredWinnerId !== player1Id && declaredWinnerId !== player2Id) {
    throw new ConflictError(
      "Le vainqueur du résultat initial ne participe pas au match.",
    );
  }

  if (proposedWinnerId === declaredWinnerId) {
    throw new BadRequestError(
      "Une correction du vainqueur doit proposer l’autre joueur.",
    );
  }

  if (proposedWinnerId !== player1Id && proposedWinnerId !== player2Id) {
    throw new BadRequestError(
      "Le vainqueur proposé doit être l’un des joueurs du match.",
    );
  }
}

export function guardMatchScoreContest(
  status: MatchStatus,
  scoreStatus: ScoreStatus,
  isBye: boolean,
  tournamentStatus: TournamentStatus,
  player1Id: string | null,
  player2Id: string | null,
  declaredById: string | null,
  actorId: string,
): void {
  if (
    tournamentStatus !== "IN_PROGRESS" ||
    isBye ||
    status !== "DECLARED" ||
    scoreStatus !== "DECLARED" ||
    declaredById === null
  ) {
    throw new ConflictError("Ce score ne peut plus être contesté.");
  }

  if (declaredById !== player1Id && declaredById !== player2Id) {
    throw new ConflictError(
      "Le résultat a été déclaré par un joueur qui ne participe pas au match.",
    );
  }

  if (actorId !== player1Id && actorId !== player2Id) {
    throw new ForbiddenError(
      "Seul un joueur de ce match peut contester le score.",
    );
  }

  if (actorId === declaredById) {
    throw new ForbiddenError(
      "Seul l’adversaire peut contester le score déclaré.",
    );
  }
}

export function guardMatchArbitration(
  status: MatchStatus,
  scoreStatus: ScoreStatus,
  isBye: boolean,
  tournamentStatus: TournamentStatus,
  player1Id: string | null,
  player2Id: string | null,
): void {
  if (
    tournamentStatus !== "IN_PROGRESS" ||
    isBye ||
    !["DECLARED", "CORRECTION_PROPOSED", "DISPUTED"].includes(status)
  ) {
    throw new ConflictError("Ce match ne peut pas être arbitré.");
  }

  if (
    (status === "DECLARED" && scoreStatus !== "DECLARED") ||
    (status !== "DECLARED" && scoreStatus !== status)
  ) {
    throw new ConflictError(
      "Les statuts du résultat et du score ne permettent pas cet arbitrage.",
    );
  }

  if (player1Id === null || player2Id === null || player1Id === player2Id) {
    throw new ConflictError(
      "Les deux joueurs du match doivent être déterminés pour l’arbitrage.",
    );
  }
}

export function guardValidatedResultCorrection(
  status: MatchStatus,
  scoreStatus: ScoreStatus,
  isBye: boolean,
  tournamentStatus: TournamentStatus,
  winnerId: string | null,
  player1Id: string | null,
  player2Id: string | null,
): void {
  if (
    tournamentStatus !== "IN_PROGRESS" ||
    isBye ||
    status !== "VALIDATED" ||
    scoreStatus !== "VALIDATED"
  ) {
    throw new ConflictError(
      "Seul un résultat validé d’un tournoi en cours peut être corrigé.",
    );
  }

  if (
    winnerId === null ||
    (winnerId !== player1Id && winnerId !== player2Id) ||
    player1Id === null ||
    player2Id === null ||
    player1Id === player2Id
  ) {
    throw new ConflictError(
      "Le vainqueur et les deux joueurs doivent correspondre au match.",
    );
  }
}
