import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
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

vi.mock("./participants", () => ({
  ManageParticipants: ({ tournamentId }: { tournamentId: string }) => (
    <div data-testid="manage-participants" data-tournament-id={tournamentId} />
  ),
}));

import TournamentParticipantsPage from "./page";
import { ManageParticipants } from "./participants";

describe("TournamentParticipantsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects anonymous visitors to login", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    await expect(
      TournamentParticipantsPage({ params: Promise.resolve({ id: "t-1" }) }),
    ).rejects.toThrow("Redirected to /connexion");
    expect(redirect).toHaveBeenCalledWith("/connexion");
  });

  it("redirects members away from the management page", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      expires: "2099-01-01T00:00:00.000Z",
      user: {
        id: "member-1",
        name: "Ada Lovelace",
        email: "ada@example.test",
        role: "MEMBER",
      },
    });

    await expect(
      TournamentParticipantsPage({ params: Promise.resolve({ id: "t-1" }) }),
    ).rejects.toThrow("Redirected to /");
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("renders participant management for admins", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      expires: "2099-01-01T00:00:00.000Z",
      user: {
        id: "admin-1",
        name: "Admin",
        email: "admin@example.test",
        role: "ADMIN",
      },
    });

    const page = await TournamentParticipantsPage({
      params: Promise.resolve({ id: "tournament-1" }),
    });

    expect(page.props.children[1]).toEqual(
      <ManageParticipants tournamentId="tournament-1" />,
    );
  });
});
