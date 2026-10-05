import { describe, expect, it, vi } from "vitest";

import { ConflictError } from "@/server/errors/app-error";
import { UserService } from "@/server/users/user.service";

const input = {
  name: "  Ada Lovelace ",
  email: " ADA@EXAMPLE.TEST ",
  temporaryPassword: "a-temporary-password",
};

describe("UserService", () => {
  it("normalizes member data, hashes the password, and returns public fields only", async () => {
    const repository = {
      createMember: vi.fn().mockResolvedValue({
        id: "user-1",
        name: "Ada Lovelace",
        email: "ada@example.test",
        role: "MEMBER",
      }),
      findMembers: vi.fn(),
      anonymizeMember: vi.fn(),
    };
    const hashPassword = vi.fn().mockResolvedValue("hashed-password");
    const service = new UserService(repository, hashPassword);

    await expect(service.createMember(input)).resolves.toEqual({
      id: "user-1",
      name: "Ada Lovelace",
      email: "ada@example.test",
      role: "MEMBER",
    });

    expect(hashPassword).toHaveBeenCalledWith("a-temporary-password");
    expect(repository.createMember).toHaveBeenCalledWith({
      name: "Ada Lovelace",
      email: "ada@example.test",
      passwordHash: "hashed-password",
    });
  });

  it("does not hash or persist invalid member data", async () => {
    const repository = {
      createMember: vi.fn(),
      findMembers: vi.fn(),
      anonymizeMember: vi.fn(),
    };
    const hashPassword = vi.fn();
    const service = new UserService(repository, hashPassword);

    await expect(
      service.createMember({ ...input, role: "ADMIN" }),
    ).rejects.toThrow();

    expect(hashPassword).not.toHaveBeenCalled();
    expect(repository.createMember).not.toHaveBeenCalled();
  });

  it("propagates duplicate email conflicts from the repository", async () => {
    const repository = {
      createMember: vi
        .fn()
        .mockRejectedValue(
          new ConflictError("Cette adresse e-mail est déjà utilisée."),
        ),
      findMembers: vi.fn(),
      anonymizeMember: vi.fn(),
    };
    const service = new UserService(
      repository,
      vi.fn().mockResolvedValue("hash"),
    );

    await expect(service.createMember(input)).rejects.toThrow(ConflictError);
  });

  it("lists members through the repository with validated pagination", async () => {
    const page = {
      items: [],
      page: 2,
      pageSize: 10,
      total: 15,
    };
    const repository = {
      createMember: vi.fn(),
      findMembers: vi.fn().mockResolvedValue(page),
      anonymizeMember: vi.fn(),
    };
    const service = new UserService(repository, vi.fn());

    await expect(
      service.listMembers({ page: "2", pageSize: "10" }),
    ).resolves.toEqual(page);
    expect(repository.findMembers).toHaveBeenCalledWith({
      page: 2,
      pageSize: 10,
    });
  });

  it("forwards the current member id to the repository for anonymization", async () => {
    const repository = {
      createMember: vi.fn(),
      findMembers: vi.fn(),
      anonymizeMember: vi.fn().mockResolvedValue(undefined),
    };
    const service = new UserService(repository, vi.fn());

    await expect(service.anonymizeMember("member-1")).resolves.toBeUndefined();
    expect(repository.anonymizeMember).toHaveBeenCalledWith("member-1");
  });
});
