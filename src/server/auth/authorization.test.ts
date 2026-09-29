import type { Session } from "next-auth";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth/auth-options", () => ({
  authOptions: {},
}));

import { authorizeSession } from "@/server/auth/authorization";
import { ForbiddenError, UnauthorizedError } from "@/server/errors/app-error";

const session = (role: "ADMIN" | "MEMBER"): Session => ({
  expires: "2099-01-01T00:00:00.000Z",
  user: {
    id: "user-1",
    name: "Test User",
    email: "test@example.test",
    role,
  },
});

describe("authorizeSession", () => {
  it("rejects missing sessions", () => {
    expect(() => authorizeSession(null)).toThrow(UnauthorizedError);
  });

  it.each(["ADMIN", "MEMBER"] as const)(
    "allows authenticated %s users when no role restriction is set",
    (role) => {
      expect(authorizeSession(session(role)).role).toBe(role);
    },
  );

  it("allows an explicitly permitted role", () => {
    expect(authorizeSession(session("ADMIN"), ["ADMIN"]).role).toBe("ADMIN");
  });

  it("rejects an authenticated user without the required role", () => {
    expect(() => authorizeSession(session("MEMBER"), ["ADMIN"])).toThrow(
      ForbiddenError,
    );
  });
});
