import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
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

vi.mock("./user-form", () => ({
  CreateMemberForm: () => <div data-testid="create-member-form" />,
}));

import { CreateMemberForm } from "./user-form";
import AdminUsersPage from "./page";

describe("AdminUsersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects anonymous visitors to login", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    await expect(AdminUsersPage()).rejects.toThrow("Redirected to /connexion");
    expect(redirect).toHaveBeenCalledWith("/connexion");
  });

  it("redirects members away from the administration page", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      expires: "2099-01-01T00:00:00.000Z",
      user: {
        id: "member-1",
        name: "Ada Lovelace",
        email: "ada@example.test",
        role: "MEMBER",
      },
    });

    await expect(AdminUsersPage()).rejects.toThrow("Redirected to /");
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("renders the form for administrators", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      expires: "2099-01-01T00:00:00.000Z",
      user: {
        id: "admin-1",
        name: "Admin",
        email: "admin@example.test",
        role: "ADMIN",
      },
    });

    const page = await AdminUsersPage();
    const children = page.props.children as ReactNode[];

    expect(redirect).not.toHaveBeenCalled();
    expect(children[2]).toEqual(<CreateMemberForm />);
  });
});
