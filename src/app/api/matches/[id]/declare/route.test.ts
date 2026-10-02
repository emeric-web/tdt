import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BadRequestError,
  ForbiddenError,
  UnauthorizedError,
} from "@/server/errors/app-error";

const { declare, requireUserWithRole } = vi.hoisted(() => ({
  declare: vi.fn(),
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
    declare = declare;
  },
}));

import { POST } from "./route";

const context = { params: Promise.resolve({ id: "match-1" }) };
const body = {
  winnerId: "player-2",
  score: [
    { p1: 4, p2: 6 },
    { p1: 6, p2: 3 },
    { p1: 4, p2: 6 },
  ],
};

describe("POST /api/matches/[id]/declare", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates a player's declaration and returns the pending result", async () => {
    requireUserWithRole.mockResolvedValue({
      id: "player-1",
      role: "MEMBER",
    });
    const result = {
      id: "match-1",
      status: "DECLARED",
      scoreStatus: "DECLARED",
    };
    declare.mockResolvedValue(result);

    const response = await POST(
      new Request("http://localhost/api/matches/match-1/declare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(requireUserWithRole).toHaveBeenCalledWith(["MEMBER"]);
    expect(declare).toHaveBeenCalledWith("match-1", "player-1", body);
  });

  it.each([
    [new UnauthorizedError(), 401],
    [new ForbiddenError(), 403],
  ])("rejects users without the member role", async (error, status) => {
    requireUserWithRole.mockRejectedValue(error);

    const response = await POST(
      new Request("http://localhost/api/matches/match-1/declare", {
        method: "POST",
        body: JSON.stringify(body),
      }),
      context,
    );

    expect(response.status).toBe(status);
    expect(declare).not.toHaveBeenCalled();
  });

  it("returns bad request for malformed JSON", async () => {
    requireUserWithRole.mockResolvedValue({
      id: "player-1",
      role: "MEMBER",
    });

    const response = await POST(
      new Request("http://localhost/api/matches/match-1/declare", {
        method: "POST",
        body: "{",
      }),
      context,
    );

    expect(response.status).toBe(400);
    expect(declare).not.toHaveBeenCalled();
  });

  it("maps invalid result data to bad request", async () => {
    requireUserWithRole.mockResolvedValue({
      id: "player-1",
      role: "MEMBER",
    });
    declare.mockRejectedValue(new BadRequestError("Score invalide."));

    const response = await POST(
      new Request("http://localhost/api/matches/match-1/declare", {
        method: "POST",
        body: JSON.stringify(body),
      }),
      context,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { message: "Score invalide." },
    });
  });
});
