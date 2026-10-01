import type { BracketRound, MatchDto } from "@/types/bracket";

const ROUND_LABELS_FROM_END = [
  "Finale",
  "Demi-finales",
  "Quarts de finale",
  "Huitièmes de finale",
];

/**
 * Groups a flat list of matches by round, sorting rounds and, within each
 * round, matches by their position so the bracket renders in the expected
 * order.
 */
export function groupByRound(matches: MatchDto[]): BracketRound[] {
  const byRound = new Map<number, MatchDto[]>();

  for (const match of matches) {
    byRound.set(match.round, [...(byRound.get(match.round) ?? []), match]);
  }

  return [...byRound.entries()]
    .sort(([a], [b]) => a - b)
    .map(([round, roundMatches]) => ({
      round,
      matches: roundMatches.sort((a, b) => a.position - b.position),
    }));
}

/**
 * Returns the human-readable label of a round, counting from the final
 * backwards (0 = Finale, 1 = Demi-finales, ...). Falls back to "Tour N" once
 * the bracket is deeper than the known labels.
 */
export function roundLabel(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  return ROUND_LABELS_FROM_END[fromEnd] ?? `Tour ${round}`;
}
