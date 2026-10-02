import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { refresh } = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

import { ScoreForm } from "./ScoreForm";

describe("ScoreForm", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.restoreAllMocks();
    refresh.mockClear();
  });

  it("submits a score and selected winner for its player", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        id: "match-1",
        status: "DECLARED",
        scoreStatus: "DECLARED",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(
      <ScoreForm
        matchId="match-1"
        player1={{ id: "player-1", name: "Ada Lovelace" }}
        player2={{ id: "player-2", name: "Alan Turing" }}
        finalSetSuperTiebreak={false}
      />,
    );

    await user.type(screen.getByLabelText("Ada Lovelace, set 1"), "6");
    await user.type(screen.getByLabelText("Alan Turing, set 1"), "4");
    await user.type(screen.getByLabelText("Ada Lovelace, set 2"), "6");
    await user.type(screen.getByLabelText("Alan Turing, set 2"), "3");
    await user.selectOptions(screen.getByLabelText("Vainqueur"), "player-1");
    await user.click(
      screen.getByRole("button", { name: "Déclarer le résultat" }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/matches/match-1/declare",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          winnerId: "player-1",
          score: [
            { p1: 6, p2: 4 },
            { p1: 6, p2: 3 },
          ],
        }),
      }),
    );
    expect(
      await screen.findByText("Résultat déclaré, en attente de confirmation."),
    ).toBeVisible();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("requires both games for the optional third set", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const user = userEvent.setup();

    render(
      <ScoreForm
        matchId="match-1"
        player1={{ id: "player-1", name: "Ada Lovelace" }}
        player2={{ id: "player-2", name: "Alan Turing" }}
        finalSetSuperTiebreak
      />,
    );

    await user.type(screen.getByLabelText("Ada Lovelace, set 1"), "6");
    await user.type(screen.getByLabelText("Alan Turing, set 1"), "4");
    await user.type(screen.getByLabelText("Ada Lovelace, set 2"), "4");
    await user.type(screen.getByLabelText("Alan Turing, set 2"), "6");
    await user.type(
      screen.getByLabelText("Ada Lovelace, super tie-break"),
      "10",
    );
    await user.selectOptions(screen.getByLabelText("Vainqueur"), "player-1");
    await user.click(
      screen.getByRole("button", { name: "Déclarer le résultat" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Renseignez les deux scores du troisième set.",
    );
  });

  it("submits an alternate winner and score as a correction proposal", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        id: "match-1",
        status: "CORRECTION_PROPOSED",
        scoreStatus: "CORRECTION_PROPOSED",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(
      <ScoreForm
        matchId="match-1"
        player1={{ id: "player-1", name: "Ada Lovelace" }}
        player2={{ id: "player-2", name: "Alan Turing" }}
        finalSetSuperTiebreak={false}
        mode="propose-correction"
        declaredWinnerId="player-1"
      />,
    );

    await user.type(screen.getByLabelText("Ada Lovelace, set 1"), "4");
    await user.type(screen.getByLabelText("Alan Turing, set 1"), "6");
    await user.type(screen.getByLabelText("Ada Lovelace, set 2"), "3");
    await user.type(screen.getByLabelText("Alan Turing, set 2"), "6");
    await user.selectOptions(screen.getByLabelText("Vainqueur"), "player-2");
    await user.click(
      screen.getByRole("button", { name: "Proposer la correction" }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/matches/match-1/propose-correction",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          winnerId: "player-2",
          score: [
            { p1: 4, p2: 6 },
            { p1: 3, p2: 6 },
          ],
        }),
      }),
    );
    expect(
      await screen.findByText(
        "Correction proposée. Le résultat reste en attente de traitement.",
      ),
    ).toBeVisible();
  });
});
