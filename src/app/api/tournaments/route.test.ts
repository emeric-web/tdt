import { beforeEach, describe, expect, it, vi } from "vitest";

const { list, create, requireUserWithRole } = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
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
    create = create;
  },
}));

import { GET, POST } from "./route";
import { ForbiddenError, UnauthorizedError } from "@/server/errors/app-error";

describe("/api/tournaments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("returns 401 and does not list tournaments without a session", async () => {
      requireUserWithRole.mockRejectedValue(new UnauthorizedError());

      const response = await GET(
        new Request("http://localhost/api/tournaments"),
      );

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        error: {
          code: "UNAUTHORIZED",
          message: "Connexion requise",
        },
      });
      expect(list).not.toHaveBeenCalled();
    });

    it("allows an authenticated user to list a page of tournaments", async () => {
      const tournaments = {
        items: [{ id: "tournament-1", name: "Club Open" }],
        page: 2,
        pageSize: 10,
        total: 12,
      };
      requireUserWithRole.mockResolvedValue({
        id: "user-1",
        role: "MEMBER",
      });
      list.mockResolvedValue(tournaments);

      const response = await GET(
        new Request(
          "http://localhost/api/tournaments?status=DRAFT&page=2&pageSize=10",
        ),
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(tournaments);
      expect(list).toHaveBeenCalledWith({
        status: "DRAFT",
        page: "2",
        pageSize: "10",
      });
    });
  });

  describe("POST", () => {
    it("rejects non-admin users before processing the request", async () => {
      requireUserWithRole.mockRejectedValue(new ForbiddenError());

      const response = await POST(
        new Request("http://localhost/api/tournaments", {
          method: "POST",
          body: JSON.stringify({}),
        }),
      );

      expect(response.status).toBe(403);
      expect(create).not.toHaveBeenCalled();
    });

    it("creates a DRAFT tournament for an administrator", async () => {
      requireUserWithRole.mockResolvedValue({
        id: "admin-1",
        role: "ADMIN",
      });
      create.mockResolvedValue({
        id: "tournament-1",
        name: "Club Open",
        startDate: null,
        status: "DRAFT",
        finalSetSuperTiebreak: false,
      });

      const response = await POST(
        new Request("http://localhost/api/tournaments", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: "Club Open",
            finalSetSuperTiebreak: false,
          }),
        }),
      );

      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({
        id: "tournament-1",
        name: "Club Open",
        status: "DRAFT",
      });
      expect(create).toHaveBeenCalledWith({
        name: "Club Open",
        finalSetSuperTiebreak: false,
      });
    });

    it("returns 400 for malformed JSON", async () => {
      requireUserWithRole.mockResolvedValue({
        id: "admin-1",
        role: "ADMIN",
      });

      const response = await POST(
        new Request("http://localhost/api/tournaments", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{",
        }),
      );

      expect(response.status).toBe(400);
      expect(create).not.toHaveBeenCalled();
    });
  });
});
