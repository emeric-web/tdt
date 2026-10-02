import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BadRequestError,
  ForbiddenError,
  UnauthorizedError,
} from "@/server/errors/app-error";

const { contestScore, requireUserWithRole } = vi.hoisted(() => ({
  contestScore: vi.fn(),
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
    contestScore = contestScore;
  },
}));

import { POST } from "./route";

const context = { params: Promise.resolve({ id: "match-1" }) };
const body = {
  score: [
    { p1: 4, p2: 6 },
    { p1: 6, p2: 3 },
    { p1: 4, p2: 6 },
  ],
};

describe("POST /api/matches/[id]/contest-score", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates the score contest for the authenticated member", async () => {
    requireUserWithRole.mockResolvedValue({
      id: "player-2",
      role: "MEMBER",
    });
    const result = {
      id: "match-1",
      status: "CORRECTION_PROPOSED",
      scoreStatus: "CORRECTION_PROPOSED",
      winnerId: null,
      proposedWinnerId: "player-1",
    };
    contestScore.mockResolvedValue(result);

    const response = await POST(
      new Request("http://localhost/api/matches/match-1/contest-score", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(requireUserWithRole).toHaveBeenCalledWith(["MEMBER"]);
    expect(contestScore).toHaveBeenCalledWith("match-1", "player-2", body);
  });

  it.each([
    [new UnauthorizedError(), 401],
    [new ForbiddenError(), 403],
  ])("rejects unauthorized or forbidden users", async (error, status) => {
    requireUserWithRole.mockRejectedValue(error);

    const response = await POST(
      new Request("http://localhost/api/matches/match-1/contest-score", {
        method: "POST",
        body: JSON.stringify(body),
      }),
      context,
    );

    expect(response.status).toBe(status);
    expect(contestScore).not.toHaveBeenCalled();
  });

  it("returns bad request for malformed JSON", async () => {
    requireUserWithRole.mockResolvedValue({
      id: "player-2",
      role: "MEMBER",
    });

    const response = await POST(
      new Request("http://localhost/api/matches/match-1/contest-score", {
        method: "POST",
        body: "{",
      }),
      context,
    );

    expect(response.status).toBe(400);
    expect(contestScore).not.toHaveBeenCalled();
  });

  it("maps a mismatched score winner to bad request", async () => {
    requireUserWithRole.mockResolvedValue({
      id: "player-2",
      role: "MEMBER",
    });
    contestScore.mockRejectedValue(
      new BadRequestError("Le score contesté doit conserver le vainqueur déclaré."),
    );

    const response = await POST(
      new Request("http://localhost/api/matches/match-1/contest-score", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      context,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: {
        message: "Le score contesté doit conserver le vainqueur déclaré.",
      },
    });
  });
});
