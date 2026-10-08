import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MatchsList } from "./matchs-list";

describe("MatchsList", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.restoreAllMocks();
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
    const fetchMock = vi.fn().mockResolvedValue(Response.json(upcomingMatches));
    vi.stubGlobal("fetch", fetchMock);

    render(<MatchsList currentUserId="player-1" />);

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

});
