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

  it("shows a member's upcoming match as a link to its dedicated page", async () => {
    const upcomingMatches = [
      {
        id: "match-1",
        tournamentId: "tournament-1",
        tournamentName: "Club Open",
        round: 2,
        roundLabel: "Quarts de finale",
        playerName: "Ada Lovelace",
        opponentName: "Grace Hopper",
        scheduledAt: "2026-10-03T16:30:00.000Z",
        court: "Court 2",
      },
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ items: [], page: 1, pageSize: 20, total: 0 }),
      )
      .mockResolvedValueOnce(Response.json(upcomingMatches));
    vi.stubGlobal("fetch", fetchMock);

    render(<TournamentDashboard currentUserId="player-1" />);

    expect(
      await screen.findByRole("heading", {
        name: "Ada Lovelace contre Grace Hopper",
      }),
    ).toBeVisible();
    expect(screen.getByText("Club Open · Quarts de finale")).toBeVisible();
    expect(screen.getByText(/Court 2/)).toBeVisible();
    expect(
      screen.getByRole("link", {
        name: /Ada Lovelace contre Grace Hopper/,
      }),
    ).toHaveAttribute("href", "/matches/match-1");
    expect(fetchMock).toHaveBeenCalledWith("/api/matches/upcoming");
  });

  it("does not request personal matches for an admin dashboard", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ items: [], page: 1, pageSize: 20, total: 0 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<TournamentDashboard isAdmin />);

    await screen.findByText("Aucun tournoi pour le moment.");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalledWith("/api/matches/upcoming");
    expect(
      screen.queryByRole("heading", { name: "Vos prochains matchs" }),
    ).not.toBeInTheDocument();
  });
});
