import { z } from "zod";

import { BadRequestError } from "@/server/errors/app-error";

const setScoreSchema = z.strictObject({
  p1: z.number().int().nonnegative(),
  p2: z.number().int().nonnegative(),
  tb: z.number().int().nonnegative().optional(),
});

export const persistedScoreSchema = z.array(setScoreSchema).max(3);
export const scoreSchema = persistedScoreSchema.min(2);

export type MatchScore = z.infer<typeof scoreSchema>;
export type ScoreWinner = "p1" | "p2";

function validateSet(
  set: MatchScore[number],
  index: number,
  finalSetSuperTiebreak: boolean,
): ScoreWinner {
  const setNumber = index + 1;
  const high = Math.max(set.p1, set.p2);
  const low = Math.min(set.p1, set.p2);

  if (index === 2 && finalSetSuperTiebreak) {
    if (set.tb !== undefined || high < 10 || high - low < 2) {
      throw new BadRequestError(
        "Le super tie-break du troisième set doit être gagné avec au moins 10 points et deux points d’écart.",
      );
    }
  } else {
    const isRegularSet = (high === 6 && low <= 4) || (high === 7 && low >= 5);

    if (!isRegularSet || (set.tb !== undefined && !(high === 7 && low === 6))) {
      throw new BadRequestError(`Le score du set ${setNumber} est invalide.`);
    }
  }

  return set.p1 > set.p2 ? "p1" : "p2";
}

function isCompleteSet(
  set: MatchScore[number],
  index: number,
  finalSetSuperTiebreak: boolean,
): boolean {
  const high = Math.max(set.p1, set.p2);
  const low = Math.min(set.p1, set.p2);

  if (index === 2 && finalSetSuperTiebreak) {
    return set.tb === undefined && high >= 10 && high - low >= 2;
  }

  return (
    (high === 6 && low <= 4) ||
    (high === 7 && low >= 5 && (set.tb === undefined || low === 6))
  );
}

/** Validates the sets recorded before a match was stopped by an abandonment. */
export function validateAbandonScore(
  input: unknown,
  finalSetSuperTiebreak: boolean,
): MatchScore {
  const score = z.array(setScoreSchema).min(1).max(3).parse(input);
  const setWinners: ScoreWinner[] = [];

  if (score.length === 3 && isCompleteSet(score[2], 2, finalSetSuperTiebreak)) {
    throw new BadRequestError(
      "Un score d’abandon ne peut pas contenir un match déjà terminé.",
    );
  }

  score.forEach((set, index) => {
    if (isCompleteSet(set, index, finalSetSuperTiebreak)) {
      if (
        index === 2 &&
        setWinners.length >= 2 &&
        setWinners[0] === setWinners[1]
      ) {
        throw new BadRequestError(
          "Un abandon ne peut pas suivre un match déjà terminé.",
        );
      }
      setWinners.push(validateSet(set, index, finalSetSuperTiebreak));
      return;
    }

    if (index !== score.length - 1 || set.tb !== undefined) {
      throw new BadRequestError(
        "Seul le dernier set d’un abandon peut être incomplet.",
      );
    }

    if (
      index === 2 && finalSetSuperTiebreak
        ? Math.max(set.p1, set.p2) >= 10 && Math.abs(set.p1 - set.p2) >= 2
        : Math.max(set.p1, set.p2) > 7
    ) {
      throw new BadRequestError("Le score partiel de l’abandon est invalide.");
    }
  });

  if (setWinners.length >= 2 && setWinners[0] === setWinners[1]) {
    throw new BadRequestError(
      "Un abandon ne peut pas suivre un match déjà terminé.",
    );
  }

  return score;
}

/** Validates a complete best-of-three match score and returns its winner. */
export function validateScore(
  input: unknown,
  finalSetSuperTiebreak: boolean,
): ScoreWinner {
  const score = scoreSchema.parse(input);
  const setWinners = score.map((set, index) =>
    validateSet(set, index, finalSetSuperTiebreak),
  );

  if (score.length === 3 && setWinners[0] === setWinners[1]) {
    throw new BadRequestError(
      "Le score ne peut pas contenir de troisième set après deux sets gagnés.",
    );
  }

  if (score.length === 2 && setWinners[0] === setWinners[1]) {
    return setWinners[0];
  }

  if (score.length === 3) {
    return setWinners[2];
  }

  throw new BadRequestError(
    "Le score doit désigner un vainqueur en deux sets gagnants.",
  );
}
