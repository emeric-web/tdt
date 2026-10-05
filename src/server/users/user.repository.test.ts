import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotFoundError } from "@/server/errors/app-error";

const { updateMany } = vi.hoisted(() => ({
  updateMany: vi.fn(),
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: { user: { updateMany } },
}));

import { PrismaUserRepository } from "@/server/users/user.repository";

describe("PrismaUserRepository.anonymizeMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes account credentials and personal fields without deleting the user", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    const repository = new PrismaUserRepository();

    await expect(
      repository.anonymizeMember("member-1"),
    ).resolves.toBeUndefined();

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "member-1", role: "MEMBER", anonymized: false },
      data: {
        name: "Joueur supprimé",
        email: "anonymized-member-1@example.invalid",
        passwordHash: null,
        anonymized: true,
      },
    });
  });

  it("reports when the member account no longer exists or is already anonymized", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    const repository = new PrismaUserRepository();

    await expect(repository.anonymizeMember("member-1")).rejects.toThrow(
      NotFoundError,
    );
  });
});
