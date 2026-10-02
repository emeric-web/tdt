import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Bracket } from "./Bracket";
import type { BracketRound, MatchDto } from "@/types/bracket";

function match(overrides: Partial<MatchDto>): MatchDto {
  return {
    id: "m1",
    round: 1,
    position: 0,
    player1: null,
    player2: null,
    status: "PENDING",
    scoreStatus: "NONE",
    winnerId: null,
    declaredById: null,
    score: null,
    proposedScore: null,
    isBye: false,
    scheduledAt: null,
    court: null,
    ...overrides,
  };
}

const rounds: BracketRound[] = [
  {
    round: 1,
    matches: [
      match({
        id: "m1",
        position: 0,
        player1: { id: "u1", name: "Alice Martin" },
        player2: null,
        status: "VALIDATED",
        scoreStatus: "VALIDATED",
        winnerId: "u1",
        isBye: true,
      }),
      match({
        id: "m2",
        position: 1,
        player1: { id: "u2", name: "Bruno Petit" },
        player2: { id: "u3", name: "Claire Dubois" },
        status: "VALIDATED",
        scoreStatus: "VALIDATED",
        winnerId: "u2",
        score: [
          { p1: 6, p2: 4 },
          { p1: 7, p2: 6, tb: 5 },
        ],
      }),
    ],
  },
  {
    round: 2,
    matches: [match({ id: "m3", position: 0, round: 2 })],
  },
];

describe("Bracket", () => {
  afterEach(cleanup);

  it("renders as many sections as there are rounds, with their labels", () => {
    render(<Bracket rounds={rounds} />);

    expect(screen.getAllByRole("region")).toHaveLength(rounds.length);
    expect(
      screen.getByRole("heading", { name: "Demi-finales" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Finale" })).toBeInTheDocument();
  });

  it("hides exempt (bye) matches, since they are never played, while keeping their slot for alignment", () => {
    const { container } = render(<Bracket rounds={rounds} />);

    expect(screen.queryByText("Alice Martin")).not.toBeInTheDocument();
    expect(screen.queryByText("Exempt")).not.toBeInTheDocument();
    expect(
      container.querySelector('li[aria-hidden="true"]'),
    ).toBeInTheDocument();
  });

  it("marks the winner and shows the score set by set", () => {
    render(<Bracket rounds={rounds} />);

    expect(screen.getByText("Bruno Petit")).toBeInTheDocument();
    expect(screen.getAllByText("6").length).toBeGreaterThan(0);
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("shows schedule details and counts matches missing a time or court", () => {
    render(<Bracket rounds={rounds} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "2 matchs à planifier.",
    );
    expect(screen.getAllByText("Horaire à confirmer")).toHaveLength(2);
    expect(screen.getAllByText(/Terrain à confirmer/)).toHaveLength(2);
  });

  it("confirms when every playable match has a time and court", () => {
    const plannedRounds = [
      {
        round: 1,
        matches: [
          match({
            player1: { id: "u1", name: "Alice Martin" },
            player2: { id: "u2", name: "Bruno Petit" },
            scheduledAt: "2026-10-02T10:00:00.000Z",
            court: "Court 1",
          }),
        ],
      },
    ];

    render(<Bracket rounds={plannedRounds} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Tous les matchs sont planifiés.",
    );
    expect(screen.getByText(/Court 1/)).toBeInTheDocument();
    expect(screen.queryByText("Horaire à confirmer")).not.toBeInTheDocument();
  });

  it("keeps every round in the bracket instead of switching between rounds", () => {
    render(<Bracket rounds={rounds} />);

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Demi-finales" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Finale" })).toBeVisible();
  });
});
