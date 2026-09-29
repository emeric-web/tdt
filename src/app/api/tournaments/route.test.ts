import { beforeEach, describe, expect, it, vi } from "vitest";

const { list, requireUserWithRole } = vi.hoisted(() => ({
  list: vi.fn(),
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
    list = list;
  },
}));

import { GET } from "./route";
import { UnauthorizedError } from "@/server/errors/app-error";

describe("GET /api/tournaments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 and does not list tournaments without a session", async () => {
    requireUserWithRole.mockRejectedValue(new UnauthorizedError());

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Connexion requise",
      },
    });
    expect(list).not.toHaveBeenCalled();
  });

  it("allows an authenticated user to list tournaments", async () => {
    const tournaments = [{ id: "tournament-1", name: "Club Open" }];
    requireUserWithRole.mockResolvedValue({
      id: "user-1",
      role: "MEMBER",
    });
    list.mockResolvedValue(tournaments);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(tournaments);
    expect(list).toHaveBeenCalledOnce();
  });
});
