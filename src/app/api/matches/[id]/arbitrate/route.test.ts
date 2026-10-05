import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForbiddenError, UnauthorizedError } from "@/server/errors/app-error";

const { arbitrate, requireUserWithRole } = vi.hoisted(() => ({
  arbitrate: vi.fn(),
  requireUserWithRole: vi.fn(),
}));

vi.mock("@/server/auth/authorization", () => ({ requireUserWithRole }));
vi.mock("@/server/matches/match.repository", () => ({
  PrismaMatchRepository: class {},
}));
vi.mock("@/server/matches/match.service", () => ({
  MatchService: class {
    arbitrate = arbitrate;
  },
}));

import { POST } from "./route";

const context = { params: Promise.resolve({ id: "match-1" }) };
const decision = {
  winnerId: "player-1",
  score: [
    { p1: 6, p2: 4 },
    { p1: 6, p2: 3 },
  ],
  resultKind: "NORMAL",
};

describe("POST /api/matches/[id]/arbitrate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("delegates decisions to administrators", async () => {
    requireUserWithRole.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    arbitrate.mockResolvedValue({ id: "match-1", status: "VALIDATED" });

    const response = await POST(
      new Request("http://localhost/api/matches/match-1/arbitrate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(decision),
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(arbitrate).toHaveBeenCalledWith("match-1", "admin-1", decision);
    expect(requireUserWithRole).toHaveBeenCalledWith(["ADMIN"]);
  });

  it.each([
    [new UnauthorizedError(), 401],
    [new ForbiddenError(), 403],
  ])("rejects unauthorized actors", async (error, status) => {
    requireUserWithRole.mockRejectedValue(error);

    const response = await POST(
      new Request("http://localhost/api/matches/match-1/arbitrate", {
        method: "POST",
        body: JSON.stringify(decision),
      }),
      context,
    );

    expect(response.status).toBe(status);
    expect(arbitrate).not.toHaveBeenCalled();
  });
});
