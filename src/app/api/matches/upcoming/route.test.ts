import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForbiddenError, UnauthorizedError } from "@/server/errors/app-error";

const { listUpcomingForPlayer, requireUserWithRole } = vi.hoisted(() => ({
  listUpcomingForPlayer: vi.fn(),
  requireUserWithRole: vi.fn(),
}));

vi.mock("@/server/auth/authorization", () => ({
  requireUserWithRole,
}));

vi.mock("@/server/matches/match.repository", () => ({
  PrismaMatchRepository: class {},
}));

vi.mock("@/server/matches/match.service", () => ({
  MatchService: class {
    listUpcomingForPlayer = listUpcomingForPlayer;
  },
}));

import { GET } from "./route";

describe("GET /api/matches/upcoming", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only the authenticated member's upcoming matches", async () => {
    const matches = [
      {
        id: "match-1",
        tournamentId: "tournament-1",
        tournamentName: "Club Open",
        round: 2,
        opponentName: "Grace Hopper",
        scheduledAt: "2026-10-03T10:00:00.000Z",
        court: "Court 1",
      },
    ];
    requireUserWithRole.mockResolvedValue({
      id: "player-1",
      role: "MEMBER",
    });
    listUpcomingForPlayer.mockResolvedValue(matches);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(matches);
    expect(requireUserWithRole).toHaveBeenCalledWith(["MEMBER"]);
    expect(listUpcomingForPlayer).toHaveBeenCalledWith("player-1");
  });

  it.each([
    [new UnauthorizedError(), 401],
    [new ForbiddenError(), 403],
  ])("rejects a caller without member access", async (error, status) => {
    requireUserWithRole.mockRejectedValue(error);

    const response = await GET();

    expect(response.status).toBe(status);
    expect(listUpcomingForPlayer).not.toHaveBeenCalled();
  });
});
