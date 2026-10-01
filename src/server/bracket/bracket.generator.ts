import { BadRequestError } from "@/server/errors/app-error";

const MINIMUM_PARTICIPANTS = 2;

export type BracketParticipant = {
  id: string;
  seed: number | null;
};

export type BracketMatch = {
  position: number;
  player1Id: string | null;
  player2Id: string | null;
  isBye: boolean;
};

/** Returns the smallest power of two greater than or equal to the participant count. */
export function computeBracketSize(participantCount: number): number {
  let size = 1;

  while (size < participantCount) {
    size *= 2;
  }

  return size;
}

/** Returns the number of rounds a bracket of the given size requires. */
export function computeRoundCount(bracketSize: number): number {
  return Math.log2(bracketSize);
}

/**
 * Generates the first-round matches of a single-elimination bracket. Seeds are placed
 * according to the standard bracket order, byes go first to the best seeds then to random
 * unseeded participants, and the remaining slots are filled at random.
 */
export function generateFirstRoundMatches(
  participants: BracketParticipant[],
  random: () => number = Math.random,
): BracketMatch[] {
  if (participants.length < MINIMUM_PARTICIPANTS) {
    throw new BadRequestError(
      "Le tirage nécessite au moins deux participants.",
    );
  }

  const bracketSize = computeBracketSize(participants.length);
  const byeCount = bracketSize - participants.length;
  const seedSlotsByRank = computeSeedSlotsByRank(bracketSize);

  const seeds = participants.filter(isSeeded).sort((a, b) => a.seed - b.seed);
  const unseeded = shuffle(
    participants.filter((participant) => !isSeeded(participant)),
    random,
  );

  const slots = new Array<string | null>(bracketSize).fill(null);
  const isSeedSlot = new Array<boolean>(bracketSize).fill(false);

  seeds.forEach((participant, index) => {
    const slot = seedSlotsByRank[index];
    slots[slot] = participant.id;
    isSeedSlot[slot] = true;
  });

  const byeSlots = chooseByeSlots(
    bracketSize,
    byeCount,
    seeds.length,
    seedSlotsByRank,
    isSeedSlot,
    random,
  );

  let unseededIndex = 0;

  for (let slot = 0; slot < bracketSize; slot += 1) {
    if (slots[slot] !== null || byeSlots.has(slot)) {
      continue;
    }

    slots[slot] = unseeded[unseededIndex].id;
    unseededIndex += 1;
  }

  return Array.from({ length: bracketSize / 2 }, (_, position) => {
    const player1Id = slots[position * 2];
    const player2Id = slots[position * 2 + 1];

    return {
      position,
      player1Id,
      player2Id,
      isBye: player1Id === null || player2Id === null,
    };
  });
}

function isSeeded(
  participant: BracketParticipant,
): participant is BracketParticipant & { seed: number } {
  return participant.seed !== null;
}

/** Returns, for each 1-indexed seed rank, the 0-indexed slot it occupies in a fully seeded bracket. */
function computeSeedSlotsByRank(bracketSize: number): number[] {
  const ranksBySlot = computeSeedRanksBySlot(bracketSize);
  const slotsByRank = new Array<number>(bracketSize);

  ranksBySlot.forEach((rank, slot) => {
    slotsByRank[rank - 1] = slot;
  });

  return slotsByRank;
}

/** Recursively builds the standard bracket seeding order (1 vs last, 2 vs second-to-last, ...). */
function computeSeedRanksBySlot(bracketSize: number): number[] {
  if (bracketSize === 1) {
    return [1];
  }

  const half = computeSeedRanksBySlot(bracketSize / 2);

  return half.flatMap((rank) => [rank, bracketSize + 1 - rank]);
}

/**
 * Picks the slots left empty for byes: the best seeds' partner slot first, then random
 * remaining pairs, never leaving both slots of the same pair empty.
 */
function chooseByeSlots(
  bracketSize: number,
  byeCount: number,
  seedCount: number,
  seedSlotsByRank: number[],
  isSeedSlot: boolean[],
  random: () => number,
): Set<number> {
  const byeSlots = new Set<number>();
  let remaining = byeCount;

  for (let rank = 1; rank <= seedCount && remaining > 0; rank += 1) {
    const slot = seedSlotsByRank[rank - 1];
    const partner = slot ^ 1;

    if (!isSeedSlot[partner] && !byeSlots.has(partner)) {
      byeSlots.add(partner);
      remaining -= 1;
    }
  }

  if (remaining > 0) {
    const pairCount = bracketSize / 2;
    const eligiblePairs = shuffle(
      Array.from({ length: pairCount }, (_, pairIndex) => pairIndex).filter(
        (pairIndex) => {
          const slotA = pairIndex * 2;
          const slotB = slotA + 1;

          return (
            !byeSlots.has(slotA) &&
            !byeSlots.has(slotB) &&
            !(isSeedSlot[slotA] && isSeedSlot[slotB])
          );
        },
      ),
      random,
    );

    for (const pairIndex of eligiblePairs) {
      if (remaining <= 0) {
        break;
      }

      const slotA = pairIndex * 2;
      const slotB = slotA + 1;
      const byeSlot = isSeedSlot[slotA] ? slotB : slotA;

      byeSlots.add(byeSlot);
      remaining -= 1;
    }
  }

  return byeSlots;
}

/** Returns a shuffled copy of the array using the Fisher-Yates algorithm. */
function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));

    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}
