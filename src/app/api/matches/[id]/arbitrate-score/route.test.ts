import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForbiddenError } from "@/server/errors/app-error";

const { arbitrateScore, requireUserWithRole } = vi.hoisted(() => ({
  arbitrateScore: vi.fn(),
  requireUserWithRole: vi.fn(),
}));

vi.mock("@/server/auth/authorization", () => ({ requireUserWithRole }));
vi.mock("@/server/matches/match.repository", () => ({
  PrismaMatchRepository: class {},
}));
vi.mock("@/server/matches/match.service", () => ({
  MatchService: class {
    arbitrateScore = arbitrateScore;
  },
}));

import { POST } from "./route";

describe("POST /api/matches/[id]/arbitrate-score", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows only an administrator to submit a score decision", async () => {
    requireUserWithRole.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    const body = {
      score: [
        { p1: 4, p2: 6 },
        { p1: 6, p2: 3 },
        { p1: 4, p2: 6 },
      ],
    };
    arbitrateScore.mockResolvedValue({
      id: "match-1",
      status: "VALIDATED",
    });

    const response = await POST(
      new Request("http://localhost/api/matches/match-1/arbitrate-score", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: "match-1" }) },
    );

    expect(response.status).toBe(200);
    expect(arbitrateScore).toHaveBeenCalledWith("match-1", "admin-1", body);
    expect(requireUserWithRole).toHaveBeenCalledWith(["ADMIN"]);
  });

  it("rejects members", async () => {
    requireUserWithRole.mockRejectedValue(new ForbiddenError());

    const response = await POST(
      new Request("http://localhost/api/matches/match-1/arbitrate-score", {
        method: "POST",
        body: "{}",
      }),
      { params: Promise.resolve({ id: "match-1" }) },
    );

    expect(response.status).toBe(403);
    expect(arbitrateScore).not.toHaveBeenCalled();
  });
});
