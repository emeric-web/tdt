import { ZodError } from "zod";
import { describe, expect, it } from "vitest";

import { BadRequestError } from "@/server/errors/app-error";
import {
  scoreSchema,
  validateAbandonScore,
  validateScore,
} from "@/server/score/score.validator";

describe("scoreSchema", () => {
  it("accepts two or three sets with non-negative integer games", () => {
    expect(
      scoreSchema.parse([
        { p1: 6, p2: 4 },
        { p1: 7, p2: 6, tb: 5 },
      ]),
    ).toEqual([
      { p1: 6, p2: 4 },
      { p1: 7, p2: 6, tb: 5 },
    ]);
    expect(
      scoreSchema.safeParse([
        { p1: 6, p2: 4 },
        { p1: 4, p2: 6 },
        { p1: 10, p2: 8 },
      ]).success,
    ).toBe(true);
  });

  it.each([
    { input: [] },
    { input: [{ p1: 6, p2: 4 }] },
    {
      input: [
        { p1: 6, p2: 4 },
        { p1: 6, p2: 4 },
        { p1: 6, p2: 4 },
        { p1: 6, p2: 4 },
      ],
    },
    {
      input: [
        { p1: 6, p2: 4.5 },
        { p1: 6, p2: 4 },
      ],
    },
    {
      input: [
        { p1: -1, p2: 4 },
        { p1: 6, p2: 4 },
      ],
    },
  ])("rejects malformed score input %#", ({ input }) => {
    expect(scoreSchema.safeParse(input).success).toBe(false);
  });
});

describe("validateScore", () => {
  it.each([
    [
      [
        { p1: 6, p2: 4 },
        { p1: 6, p2: 3 },
      ],
      "p1",
    ],
    [
      [
        { p1: 4, p2: 6 },
        { p1: 3, p2: 6 },
      ],
      "p2",
    ],
    [
      [
        { p1: 6, p2: 4 },
        { p1: 4, p2: 6 },
        { p1: 6, p2: 0 },
      ],
      "p1",
    ],
    [
      [
        { p1: 7, p2: 6, tb: 5 },
        { p1: 4, p2: 6 },
        { p1: 6, p2: 3 },
      ],
      "p1",
    ],
  ] as const)(
    "returns the winner for valid regular scores",
    (score, winner) => {
      expect(validateScore(score, false)).toBe(winner);
    },
  );

  it("accepts a regular deciding set when the tournament does not use a super tie-break", () => {
    expect(
      validateScore(
        [
          { p1: 6, p2: 2 },
          { p1: 3, p2: 6 },
          { p1: 7, p2: 5 },
        ],
        false,
      ),
    ).toBe("p1");
  });

  describe("validateAbandonScore", () => {
    it("preserves completed sets and an incomplete final set", () => {
      expect(
        validateAbandonScore(
          [
            { p1: 6, p2: 4 },
            { p1: 4, p2: 6 },
            { p1: 3, p2: 2 },
          ],
          false,
        ),
      ).toHaveLength(3);
    });

    it("allows a forfeit to be represented without invented games only at the service layer", () => {
      expect(() => validateAbandonScore([], false)).toThrow();
    });

    it.each([
      [
        { p1: 6, p2: 4 },
        { p1: 4, p2: 6 },
        { p1: 6, p2: 1 },
      ],
      [{ p1: 8, p2: 4 }],
      [{ p1: 4, p2: 2, tb: 3 }],
    ])("rejects an invalid abandonment score sequence %#", (...score) => {
      expect(() => validateAbandonScore(score, false)).toThrow(BadRequestError);
    });
  });

  it.each([
    { p1: 10, p2: 8 },
    { p1: 8, p2: 10 },
    { p1: 10, p2: 12 },
    { p1: 11, p2: 13 },
  ])("accepts a deciding super tie-break $p1-$p2", (superTieBreak) => {
    expect(
      validateScore([{ p1: 6, p2: 4 }, { p1: 4, p2: 6 }, superTieBreak], true),
    ).toBe(superTieBreak.p1 > superTieBreak.p2 ? "p1" : "p2");
  });

  it.each([
    {
      score: [
        { p1: 6, p2: 6 },
        { p1: 6, p2: 4 },
      ],
      isSuper: false,
    },
    {
      score: [
        { p1: 6, p2: 5 },
        { p1: 6, p2: 4 },
      ],
      isSuper: false,
    },
    {
      score: [
        { p1: 7, p2: 5, tb: 4 },
        { p1: 6, p2: 4 },
      ],
      isSuper: false,
    },
    {
      score: [
        { p1: 6, p2: 4, tb: 5 },
        { p1: 6, p2: 4 },
      ],
      isSuper: false,
    },
    {
      score: [
        { p1: 6, p2: 4 },
        { p1: 6, p2: 4 },
        { p1: 0, p2: 10 },
      ],
      isSuper: true,
    },
    {
      score: [
        { p1: 6, p2: 4 },
        { p1: 4, p2: 6 },
        { p1: 10, p2: 9 },
      ],
      isSuper: true,
    },
    {
      score: [
        { p1: 6, p2: 4 },
        { p1: 4, p2: 6 },
        { p1: 10, p2: 8, tb: 6 },
      ],
      isSuper: true,
    },
  ])("rejects invalid set formats or sequences %#", ({ score, isSuper }) => {
    expect(() => validateScore(score, isSuper)).toThrow(BadRequestError);
  });

  it("rejects a match without a winner after two sets", () => {
    expect(() =>
      validateScore(
        [
          { p1: 6, p2: 4 },
          { p1: 4, p2: 6 },
        ],
        false,
      ),
    ).toThrow("Le score doit désigner un vainqueur en deux sets gagnants.");
  });

  it("rejects structurally invalid input as a Zod validation error", () => {
    expect(() => validateScore([{ p1: 6, p2: 4 }], false)).toThrow(ZodError);
  });
});
