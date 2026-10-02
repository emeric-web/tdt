import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BadRequestError,
  ForbiddenError,
  UnauthorizedError,
} from "@/server/errors/app-error";

const { proposeCorrection, requireUserWithRole } = vi.hoisted(() => ({
  proposeCorrection: vi.fn(),
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
    proposeCorrection = proposeCorrection;
  },
}));

import { POST } from "./route";

const context = { params: Promise.resolve({ id: "match-1" }) };
const body = {
  winnerId: "player-1",
  score: [
    { p1: 6, p2: 4 },
    { p1: 6, p2: 3 },
  ],
};

describe("POST /api/matches/[id]/propose-correction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates a member's correction proposal", async () => {
    requireUserWithRole.mockResolvedValue({
      id: "player-2",
      role: "MEMBER",
    });
    const result = {
      id: "match-1",
      status: "CORRECTION_PROPOSED",
      scoreStatus: "CORRECTION_PROPOSED",
    };
    proposeCorrection.mockResolvedValue(result);

    const response = await POST(
      new Request("http://localhost/api/matches/match-1/propose-correction", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(requireUserWithRole).toHaveBeenCalledWith(["MEMBER"]);
    expect(proposeCorrection).toHaveBeenCalledWith("match-1", "player-2", body);
  });

  it.each([
    [new UnauthorizedError(), 401],
    [new ForbiddenError(), 403],
  ])(
    "rejects users who cannot access member actions",
    async (error, status) => {
      requireUserWithRole.mockRejectedValue(error);

      const response = await POST(
        new Request("http://localhost/api/matches/match-1/propose-correction", {
          method: "POST",
          body: JSON.stringify(body),
        }),
        context,
      );

      expect(response.status).toBe(status);
      expect(proposeCorrection).not.toHaveBeenCalled();
    },
  );

  it("returns bad request for malformed JSON", async () => {
    requireUserWithRole.mockResolvedValue({
      id: "player-2",
      role: "MEMBER",
    });

    const response = await POST(
      new Request("http://localhost/api/matches/match-1/propose-correction", {
        method: "POST",
        body: "{",
      }),
      context,
    );

    expect(response.status).toBe(400);
    expect(proposeCorrection).not.toHaveBeenCalled();
  });

  it("maps an invalid proposal to bad request", async () => {
    requireUserWithRole.mockResolvedValue({
      id: "player-2",
      role: "MEMBER",
    });
    proposeCorrection.mockRejectedValue(
      new BadRequestError("Le vainqueur doit être l’un des joueurs du match."),
    );

    const response = await POST(
      new Request("http://localhost/api/matches/match-1/propose-correction", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      context,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { message: "Le vainqueur doit être l’un des joueurs du match." },
    });
  });
});
