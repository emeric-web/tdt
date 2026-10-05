import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForbiddenError } from "@/server/errors/app-error";

const { anonymizeMember, requireUserWithRole } = vi.hoisted(() => ({
  anonymizeMember: vi.fn(),
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
    anonymizeMember = anonymizeMember;
  },
}));

import { DELETE } from "./route";

describe("DELETE /api/users/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("anonymizes only the authenticated member account", async () => {
    requireUserWithRole.mockResolvedValue({ id: "member-1", role: "MEMBER" });

    const response = await DELETE();

    expect(response.status).toBe(204);
    expect(requireUserWithRole).toHaveBeenCalledWith(["MEMBER"]);
    expect(anonymizeMember).toHaveBeenCalledWith("member-1");
  });

  it("rejects administrators and does not anonymize an account", async () => {
    requireUserWithRole.mockRejectedValue(new ForbiddenError());

    const response = await DELETE();

    expect(response.status).toBe(403);
    expect(anonymizeMember).not.toHaveBeenCalled();
  });
});
