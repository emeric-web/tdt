import { beforeEach, describe, expect, it, vi } from "vitest";

import { UnauthorizedError } from "@/server/errors/app-error";

const { getBracket, requireUserWithRole } = vi.hoisted(() => ({
  getBracket: vi.fn(),
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
    getBracket = getBracket;
  },
}));

import { GET } from "./route";

const context = { params: Promise.resolve({ id: "tournament-1" }) };

describe("GET /api/tournaments/[id]/bracket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the persisted bracket to authenticated users", async () => {
    requireUserWithRole.mockResolvedValue({ id: "member-1", role: "MEMBER" });
    const bracket = {
      tournament: {
        id: "tournament-1",
        name: "Club Open",
        startDate: null,
        finalSetSuperTiebreak: false,
        status: "DRAFT",
      },
      rounds: [],
    };
    getBracket.mockResolvedValue(bracket);

    const response = await GET(
      new Request("http://localhost/api/tournaments/tournament-1/bracket"),
      context,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(bracket);
    expect(requireUserWithRole).toHaveBeenCalledWith();
    expect(getBracket).toHaveBeenCalledWith("tournament-1");
  });

  it("rejects unauthenticated users", async () => {
    requireUserWithRole.mockRejectedValue(new UnauthorizedError());

    const response = await GET(
      new Request("http://localhost/api/tournaments/tournament-1/bracket"),
      context,
    );

    expect(response.status).toBe(401);
    expect(getBracket).not.toHaveBeenCalled();
  });

  it("allows administrators as authenticated users", async () => {
    requireUserWithRole.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    getBracket.mockResolvedValue({ tournament: {}, rounds: [] });

    const response = await GET(
      new Request("http://localhost/api/tournaments/tournament-1/bracket"),
      context,
    );

    expect(response.status).toBe(200);
    expect(getBracket).toHaveBeenCalledWith("tournament-1");
  });
});
