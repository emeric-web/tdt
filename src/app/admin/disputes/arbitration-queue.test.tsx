import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

import { ArbitrationQueue } from "./arbitration-queue";

const match = {
  id: "match-1",
  tournamentId: "tournament-1",
  tournamentName: "Club Open",
  round: 1,
  position: 0,
  status: "CORRECTION_PROPOSED" as const,
  scoreStatus: "CORRECTION_PROPOSED" as const,
  declaredWinnerId: "player-2",
  proposedWinnerId: "player-1",
  declaredScore: [
    { p1: 4, p2: 6 },
    { p1: 6, p2: 3 },
    { p1: 4, p2: 6 },
  ],
  proposedScore: [
    { p1: 6, p2: 4 },
    { p1: 6, p2: 3 },
  ],
  player1: { id: "player-1", name: "Ada Lovelace" },
  player2: { id: "player-2", name: "Grace Hopper" },
  finalSetSuperTiebreak: false,
};

describe("ArbitrationQueue", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.restoreAllMocks();
    refresh.mockClear();
  });

  it("submits and refreshes a validated winner and score decision", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ id: "match-1" }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<ArbitrationQueue matches={[match]} />);

    await user.selectOptions(
      screen.getByLabelText("Vainqueur définitif"),
      "player-1",
    );
    await user.click(
      screen.getByRole("button", { name: "Valider l’arbitrage" }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/matches/match-1/arbitrate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          winnerId: "player-1",
          score: [
            { p1: 6, p2: 4 },
            { p1: 6, p2: 3 },
          ],
          resultKind: "NORMAL",
        }),
      }),
    );
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("requires and sends a reason for a forfeit", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ id: "match-1" }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<ArbitrationQueue matches={[match]} />);

    await user.selectOptions(
      screen.getByLabelText("Type de résultat"),
      "FORFEIT",
    );
    await user.type(screen.getByLabelText("Motif"), "Absence au match");
    await user.click(
      screen.getByRole("button", { name: "Valider l’arbitrage" }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/matches/match-1/arbitrate",
      expect.objectContaining({
        body: JSON.stringify({
          winnerId: "player-1",
          score: [],
          resultKind: "FORFEIT",
          reason: "Absence au match",
        }),
      }),
    );
  });
});
