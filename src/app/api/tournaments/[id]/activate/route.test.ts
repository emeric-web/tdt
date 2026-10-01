import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForbiddenError } from "@/server/errors/app-error";

const { activate, requireUserWithRole } = vi.hoisted(() => ({
  activate: vi.fn(),
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
    activate = activate;
  },
}));

import { POST } from "./route";

const context = { params: Promise.resolve({ id: "tournament-1" }) };

describe("POST /api/tournaments/[id]/activate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("activates the tournament for administrators", async () => {
    requireUserWithRole.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    const tournament = {
      id: "tournament-1",
      name: "Club Open",
      startDate: null,
      status: "IN_PROGRESS",
      finalSetSuperTiebreak: false,
    };
    activate.mockResolvedValue(tournament);

    const response = await POST(
      new Request("http://localhost/api/tournaments/tournament-1/activate", {
        method: "POST",
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(tournament);
    expect(activate).toHaveBeenCalledWith("tournament-1", "admin-1");
  });

  it("rejects members before activating the tournament", async () => {
    requireUserWithRole.mockRejectedValue(new ForbiddenError());

    const response = await POST(
      new Request("http://localhost/api/tournaments/tournament-1/activate", {
        method: "POST",
      }),
      context,
    );

    expect(response.status).toBe(403);
    expect(activate).not.toHaveBeenCalled();
  });
});
