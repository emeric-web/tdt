import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForbiddenError } from "@/server/errors/app-error";

const { createMember, listMembers, requireUserWithRole } = vi.hoisted(() => ({
  createMember: vi.fn(),
  listMembers: vi.fn(),
  requireUserWithRole: vi.fn(),
}));

vi.mock("@/server/auth/authorization", () => ({
  requireUserWithRole,
}));

vi.mock("@/server/users/user.repository", () => ({
  PrismaUserRepository: class {},
}));

vi.mock("@/server/users/user.service", () => ({
  UserService: class {
    createMember = createMember;
    listMembers = listMembers;
  },
}));

import { GET, POST } from "./route";

describe("POST /api/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/users", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("lists members only for administrators", async () => {
      requireUserWithRole.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
      const members = {
        items: [{ id: "member-1", name: "Ada", email: "ada@example.test" }],
        page: 1,
        pageSize: 20,
        total: 1,
      };
      listMembers.mockResolvedValue(members);

      const response = await GET(
        new Request("http://localhost/api/users?page=1&pageSize=20"),
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(members);
      expect(listMembers).toHaveBeenCalledWith({ page: "1", pageSize: "20" });
    });

    it("rejects members", async () => {
      requireUserWithRole.mockRejectedValue(new ForbiddenError());

      const response = await GET(new Request("http://localhost/api/users"));

      expect(response.status).toBe(403);
      expect(listMembers).not.toHaveBeenCalled();
    });
  });

  it("rejects non-admin users before processing the request", async () => {
    requireUserWithRole.mockRejectedValue(new ForbiddenError());

    const response = await POST(
      new Request("http://localhost/api/users", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(403);
    expect(createMember).not.toHaveBeenCalled();
  });

  it("creates a member and returns 201 with only public data", async () => {
    requireUserWithRole.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    createMember.mockResolvedValue({
      id: "member-1",
      name: "Ada Lovelace",
      email: "ada@example.test",
      role: "MEMBER",
    });

    const response = await POST(
      new Request("http://localhost/api/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Ada Lovelace",
          email: "ada@example.test",
          temporaryPassword: "a-temporary-password",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      id: "member-1",
      name: "Ada Lovelace",
      email: "ada@example.test",
      role: "MEMBER",
    });
    expect(createMember).toHaveBeenCalledWith({
      name: "Ada Lovelace",
      email: "ada@example.test",
      temporaryPassword: "a-temporary-password",
    });
  });

  it("returns 400 for malformed JSON", async () => {
    requireUserWithRole.mockResolvedValue({ id: "admin-1", role: "ADMIN" });

    const response = await POST(
      new Request("http://localhost/api/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    expect(createMember).not.toHaveBeenCalled();
  });
});
