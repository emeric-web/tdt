import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForbiddenError, UnauthorizedError } from "@/server/errors/app-error";

const { correctResult, requireUserWithRole } = vi.hoisted(() => ({
  correctResult: vi.fn(),
  requireUserWithRole: vi.fn(),
}));

vi.mock("@/server/auth/authorization", () => ({ requireUserWithRole }));
vi.mock("@/server/matches/match.repository", () => ({
  PrismaMatchRepository: class {},
}));
vi.mock("@/server/matches/match.service", () => ({
  MatchService: class {
    correctResult = correctResult;
  },
}));

import { POST } from "./route";

const context = { params: Promise.resolve({ id: "match-1" }) };
const body = {
  score: [
    { p1: 6, p2: 4 },
    { p1: 6, p2: 3 },
  ],
  reason: "Correction après vérification de la feuille.",
};

describe("POST /api/matches/[id]/correct-result", () => {
  beforeEach(() => vi.clearAllMocks());

  it("delegates corrections to administrators", async () => {
    requireUserWithRole.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    correctResult.mockResolvedValue({
      id: "match-1",
      status: "VALIDATED",
    });

    const response = await POST(
      new Request("http://localhost/api/matches/match-1/correct-result", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(correctResult).toHaveBeenCalledWith("match-1", "admin-1", body);
    expect(requireUserWithRole).toHaveBeenCalledWith(["ADMIN"]);
  });

  it.each([
    [new UnauthorizedError(), 401],
    [new ForbiddenError(), 403],
  ])("rejects unauthorized actors", async (error, status) => {
    requireUserWithRole.mockRejectedValue(error);

    const response = await POST(
      new Request("http://localhost/api/matches/match-1/correct-result", {
        method: "POST",
        body: JSON.stringify(body),
      }),
      context,
    );

    expect(response.status).toBe(status);
    expect(correctResult).not.toHaveBeenCalled();
  });
});
