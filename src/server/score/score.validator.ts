import { z } from "zod";

import { BadRequestError } from "@/server/errors/app-error";

const setScoreSchema = z.strictObject({
  p1: z.number().int().nonnegative(),
  p2: z.number().int().nonnegative(),
  tb: z.number().int().nonnegative().optional(),
});

export const scoreSchema = z.array(setScoreSchema).min(2).max(3);

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
