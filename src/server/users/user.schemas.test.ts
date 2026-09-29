import { describe, expect, it } from "vitest";

import { createMemberSchema } from "@/server/users/user.schemas";

describe("createMemberSchema", () => {
  it("trims names and normalizes email addresses", () => {
    expect(
      createMemberSchema.parse({
        name: " Ada Lovelace ",
        email: " ADA@EXAMPLE.TEST ",
        temporaryPassword: "a-temporary-password",
      }),
    ).toEqual({
      name: "Ada Lovelace",
      email: "ada@example.test",
      temporaryPassword: "a-temporary-password",
    });
  });

  it.each([
    {
      name: " ",
      email: "ada@example.test",
      temporaryPassword: "long-password-1",
    },
    {
      name: "a".repeat(101),
      email: "ada@example.test",
      temporaryPassword: "long-password-1",
    },
    { name: "Ada", email: "invalid", temporaryPassword: "long-password-1" },
    { name: "Ada", email: "ada@example.test", temporaryPassword: "short" },
    {
      name: "Ada",
      email: "ada@example.test",
      temporaryPassword: "é".repeat(37),
    },
    {
      name: "Ada",
      email: "ada@example.test",
      temporaryPassword: "long-password-1",
      role: "ADMIN",
    },
  ])("rejects invalid or unexpected account fields", (candidate) => {
    expect(createMemberSchema.safeParse(candidate).success).toBe(false);
  });
});
