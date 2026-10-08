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

vi.mock("./tournament-form", () => ({
  CreateTournamentForm: () => <div data-testid="create-tournament-form" />,
}));

import AdminTournamentsPage from "./page";
import { CreateTournamentForm } from "./tournament-form";

describe("AdminTournamentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects anonymous visitors to login", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    await expect(AdminTournamentsPage()).rejects.toThrow(
      "Redirected to /connexion",
    );
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

    await expect(AdminTournamentsPage()).rejects.toThrow("Redirected to /");
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("renders the creation form for administrators", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      expires: "2099-01-01T00:00:00.000Z",
      user: {
        id: "admin-1",
        name: "Admin",
        email: "admin@example.test",
        role: "ADMIN",
      },
    });

    const page = await AdminTournamentsPage();
    const children = page.props.children as ReactNode[];

    expect(redirect).not.toHaveBeenCalled();
    expect(children.at(-1)).toEqual(<CreateTournamentForm />);
  });
});
