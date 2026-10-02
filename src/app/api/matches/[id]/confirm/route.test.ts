import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForbiddenError, UnauthorizedError } from "@/server/errors/app-error";

const { confirm, requireUserWithRole } = vi.hoisted(() => ({
  confirm: vi.fn(),
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
    confirm = confirm;
  },
}));

import { POST } from "./route";

const context = { params: Promise.resolve({ id: "match-1" }) };

describe("POST /api/matches/[id]/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("confirms the result for the authenticated member", async () => {
    requireUserWithRole.mockResolvedValue({
      id: "player-2",
      role: "MEMBER",
    });
    const result = {
      id: "match-1",
      status: "VALIDATED",
      scoreStatus: "VALIDATED",
      winnerId: "player-1",
    };
    confirm.mockResolvedValue(result);

    const response = await POST(
      new Request("http://localhost/api/matches/match-1/confirm", {
        method: "POST",
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(requireUserWithRole).toHaveBeenCalledWith(["MEMBER"]);
    expect(confirm).toHaveBeenCalledWith("match-1", "player-2");
  });

  it.each([
    [new UnauthorizedError(), 401],
    [new ForbiddenError(), 403],
  ])("rejects unauthorized or forbidden users", async (error, status) => {
    requireUserWithRole.mockRejectedValue(error);

    const response = await POST(
      new Request("http://localhost/api/matches/match-1/confirm", {
        method: "POST",
      }),
      context,
    );

    expect(response.status).toBe(status);
    expect(confirm).not.toHaveBeenCalled();
  });
});
