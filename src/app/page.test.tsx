import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`Redirected to ${path}`);
  }),
}));

vi.mock("@/server/auth/auth-options", () => ({
  authOptions: {},
}));

import Home from "./page";

describe("Home page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects anonymous visitors to the login page", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    await expect(Home()).rejects.toThrow("Redirected to /login");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("renders the welcome page for an authenticated user", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      expires: "2099-01-01T00:00:00.000Z",
      user: {
        id: "user-1",
        name: "Ada Lovelace",
        email: "ada@example.test",
        role: "MEMBER",
      },
    });

    const page = await Home();
    const children = page.props.children as React.ReactNode[];

    expect(redirect).not.toHaveBeenCalled();
    expect(
      (children[1] as ReactElement<{ children: ReactNode }>).props.children,
    ).toEqual(["Bienvenue, ", "Ada Lovelace", "."]);
  });
});
