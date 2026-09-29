import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForbiddenError } from "@/server/errors/app-error";

const { createMember, requireUserWithRole } = vi.hoisted(() => ({
  createMember: vi.fn(),
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
  },
}));

import { POST } from "./route";

describe("POST /api/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
