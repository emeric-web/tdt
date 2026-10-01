import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForbiddenError } from "@/server/errors/app-error";

const { draw, requireUserWithRole } = vi.hoisted(() => ({
  draw: vi.fn(),
  requireUserWithRole: vi.fn(),
}));

vi.mock("@/server/auth/authorization", () => ({
  requireUserWithRole,
}));

vi.mock("@/server/tournaments/tournament.repository", () => ({
  PrismaTournamentRepository: class {},
}));

vi.mock("@/server/tournaments/tournament.service", () => ({
  TournamentService: class {
    draw = draw;
  },
}));

import { POST } from "./route";

const context = { params: Promise.resolve({ id: "tournament-1" }) };

describe("/api/tournaments/[id]/draw", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates the bracket for administrators", async () => {
    requireUserWithRole.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    const matches = [
      {
        id: "match-1",
        round: 1,
        position: 0,
        player1Id: "participant-1",
        player2Id: "participant-2",
        winnerId: null,
        isBye: false,
        nextMatchId: null,
        nextSlot: null,
      },
    ];
    draw.mockResolvedValue(matches);

    const response = await POST(
      new Request("http://localhost/api/tournaments/tournament-1/draw", {
        method: "POST",
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(matches);
    expect(draw).toHaveBeenCalledWith("tournament-1", "admin-1");
  });

  it("rejects members before generating the bracket", async () => {
    requireUserWithRole.mockRejectedValue(new ForbiddenError());

    const response = await POST(
      new Request("http://localhost/api/tournaments/tournament-1/draw", {
        method: "POST",
      }),
      context,
    );

    expect(response.status).toBe(403);
    expect(draw).not.toHaveBeenCalled();
  });
});
