import { describe, expect, it, vi } from "vitest";

import { AuthService } from "@/server/auth/auth.service";

const credentialUser = {
  id: "user-1",
  name: "Ada Lovelace",
  email: "ada@example.test",
  passwordHash: "hashed-password",
  role: "MEMBER" as const,
  anonymized: false,
};

describe("AuthService", () => {
  it("normalizes the email and returns only public user fields", async () => {
    const repository = {
      findCredentialUserByEmail: vi.fn().mockResolvedValue(credentialUser),
    };
    const verifyPassword = vi.fn().mockResolvedValue(true);
    const service = new AuthService(repository, verifyPassword);

    await expect(
      service.authenticate({
        email: " ADA@EXAMPLE.TEST ",
        password: "valid-password",
      }),
    ).resolves.toEqual({
      id: "user-1",
      name: "Ada Lovelace",
      email: "ada@example.test",
      role: "MEMBER",
    });

    expect(repository.findCredentialUserByEmail).toHaveBeenCalledWith(
      "ada@example.test",
    );
    expect(verifyPassword).toHaveBeenCalledWith(
      "valid-password",
      "hashed-password",
    );
  });

  it("rejects malformed credentials without querying the repository", async () => {
    const repository = {
      findCredentialUserByEmail: vi.fn(),
    };
    const service = new AuthService(repository, vi.fn());

    await expect(
      service.authenticate({ email: "not-an-email", password: "" }),
    ).resolves.toBeNull();
    expect(repository.findCredentialUserByEmail).not.toHaveBeenCalled();
  });

  it("rejects unknown users and anonymized accounts", async () => {
    const repository = {
      findCredentialUserByEmail: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...credentialUser, anonymized: true }),
    };
    const verifyPassword = vi.fn();
    const service = new AuthService(repository, verifyPassword);
    const credentials = {
      email: credentialUser.email,
      password: "valid-password",
    };

    await expect(service.authenticate(credentials)).resolves.toBeNull();
    await expect(service.authenticate(credentials)).resolves.toBeNull();
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("rejects an incorrect password", async () => {
    const repository = {
      findCredentialUserByEmail: vi.fn().mockResolvedValue(credentialUser),
    };
    const service = new AuthService(
      repository,
      vi.fn().mockResolvedValue(false),
    );

    await expect(
      service.authenticate({
        email: credentialUser.email,
        password: "incorrect-password",
      }),
    ).resolves.toBeNull();
  });

  it("rejects passwords exceeding bcrypt's 72-byte limit", async () => {
    const repository = {
      findCredentialUserByEmail: vi.fn(),
    };
    const service = new AuthService(repository, vi.fn());

    await expect(
      service.authenticate({
        email: credentialUser.email,
        password: "a".repeat(73),
      }),
    ).resolves.toBeNull();
    expect(repository.findCredentialUserByEmail).not.toHaveBeenCalled();
  });
});
