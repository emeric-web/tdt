import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TournamentDashboard } from "./tournament-dashboard";

describe("TournamentDashboard", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("lists tournaments and loads the next page", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          items: [
            {
              id: "tournament-1",
              name: "Club Open",
              startDate: null,
              status: "DRAFT",
              finalSetSuperTiebreak: false,
            },
          ],
          page: 1,
          pageSize: 1,
          total: 2,
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          items: [
            {
              id: "tournament-2",
              name: "Autumn Cup",
              startDate: "2026-10-15T00:00:00.000Z",
              status: "IN_PROGRESS",
              finalSetSuperTiebreak: true,
            },
          ],
          page: 2,
          pageSize: 1,
          total: 2,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<TournamentDashboard />);

    expect(
      await screen.findByRole("heading", { name: "Club Open" }),
    ).toBeVisible();
    expect(screen.getByText("En préparation")).toBeVisible();
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/tournaments?page=1&pageSize=20",
    );

    await user.click(screen.getByRole("button", { name: "Page suivante" }));

    expect(
      await screen.findByRole("heading", { name: "Autumn Cup" }),
    ).toBeVisible();
    expect(screen.getByText("En cours")).toBeVisible();
    expect(
      screen.getByRole("link", {
        name: "Consulter le tableau et les horaires",
      }),
    ).toHaveAttribute("href", "/tournaments/tournament-2");
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/tournaments?page=2&pageSize=20",
    );
  });

  it("shows an empty state when there are no tournaments", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ items: [], page: 1, pageSize: 20, total: 0 }),
        ),
    );

    render(<TournamentDashboard />);

    expect(
      await screen.findByText("Aucun tournoi pour le moment."),
    ).toBeVisible();
  });
});
