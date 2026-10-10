import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

import { ScheduleQueue } from "./schedule-queue";

const match = {
  id: "match-1",
  tournamentId: "tournament-1",
  tournamentName: "Club Open",
  round: 1,
  position: 0,
  player1: { id: "player-1", name: "Ada Lovelace" },
  player2: { id: "player-2", name: "Grace Hopper" },
  scheduledAt: null,
  court: null,
};

describe("ScheduleQueue", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.restoreAllMocks();
    refresh.mockClear();
  });

  it("shows an empty state", () => {
    render(<ScheduleQueue matches={[]} />);

    expect(screen.getByText("Aucun match à planifier.")).toBeVisible();
  });

  it("schedules a match and refreshes the page", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ id: "match-1" }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<ScheduleQueue matches={[match]} />);

    fireEvent.change(screen.getByLabelText("Date et heure"), {
      target: { value: "2026-10-12T18:30" },
    });
    await user.type(screen.getByLabelText("Court"), "Court 1");
    await user.click(screen.getByRole("button", { name: "Planifier" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/matches/match-1/schedule", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scheduledAt: new Date("2026-10-12T18:30").toISOString(),
        court: "Court 1",
      }),
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the API error without refreshing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          { error: { message: "Match déjà planifié." } },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();

    render(<ScheduleQueue matches={[match]} />);

    fireEvent.change(screen.getByLabelText("Date et heure"), {
      target: { value: "2026-10-12T18:30" },
    });
    await user.type(screen.getByLabelText("Court"), "Court 1");
    await user.click(screen.getByRole("button", { name: "Planifier" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Match déjà planifié.",
    );
    expect(refresh).not.toHaveBeenCalled();
  });
});
