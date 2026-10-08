import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

import { ResultCorrectionQueue } from "./result-correction";

const match = {
  id: "match-1",
  tournamentId: "tournament-1",
  tournamentName: "Club Open",
  round: 1,
  position: 0,
  winnerId: "player-1",
  score: [
    { p1: 6, p2: 4 },
    { p1: 6, p2: 3 },
  ],
  resultKind: "NORMAL" as const,
  player1: { id: "player-1", name: "Ada Lovelace" },
  player2: { id: "player-2", name: "Grace Hopper" },
};

describe("ResultCorrectionQueue", () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.restoreAllMocks();
    refresh.mockClear();
  });

  it("submits the correction and its reason for a validated match", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ id: "match-1" }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<ResultCorrectionQueue matches={[match]} />);

    await user.selectOptions(screen.getByLabelText("Vainqueur"), "player-2");
    await user.type(
      screen.getByLabelText("Motif obligatoire"),
      "La feuille officielle confirme l’autre vainqueur.",
    );
    await user.click(
      screen.getByRole("button", { name: "Enregistrer la correction" }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/matches/match-1/correct-result",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          winnerId: "player-2",
          score: [
            { p1: 6, p2: 4 },
            { p1: 6, p2: 3 },
          ],
          resultKind: "NORMAL",
          reason: "La feuille officielle confirme l’autre vainqueur.",
        }),
      }),
    );
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows a rejected correction without refreshing the page", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: { message: "Le match suivant a déjà commencé." } },
            { status: 409 },
          ),
        ),
    );
    const user = userEvent.setup();

    render(<ResultCorrectionQueue matches={[match]} />);
    await user.type(
      screen.getByLabelText("Motif obligatoire"),
      "Correction vérifiée.",
    );
    await user.type(screen.getByLabelText("Ada Lovelace, set 1"), "7");
    await user.click(
      screen.getByRole("button", { name: "Enregistrer la correction" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Le match suivant a déjà commencé.",
    );
    expect(refresh).not.toHaveBeenCalled();
  });
});
