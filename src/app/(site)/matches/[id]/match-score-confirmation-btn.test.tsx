import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { refresh } = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

import { MatchScoreConfirmationBtn } from "./match-score-confirmation-btn";

describe("MatchConfirmationBtn", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.restoreAllMocks();
    refresh.mockClear();
  });

  it("posts the confirmation and refreshes the match page", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        id: "match-1",
        status: "VALIDATED",
        scoreStatus: "VALIDATED",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<MatchScoreConfirmationBtn matchId="match-1" />);
    await user.click(
      screen.getByRole("button", { name: "Confirmer le résultat" }),
    );

    expect(fetchMock).toHaveBeenCalledWith("/api/matches/match-1/confirm", {
      method: "POST",
    });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows API errors without refreshing the page", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: { message: "Le résultat a changé." } },
            { status: 409 },
          ),
        ),
    );
    const user = userEvent.setup();

    render(<MatchScoreConfirmationBtn matchId="match-1" />);
    await user.click(
      screen.getByRole("button", { name: "Confirmer le résultat" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Le résultat a changé.",
    );
    expect(refresh).not.toHaveBeenCalled();
  });
});
