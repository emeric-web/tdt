import { cleanup, render, screen } from "@testing-library/react";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NotFoundError } from "@/server/errors/app-error";

const { getDetails } = vi.hoisted(() => ({
  getDetails: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  notFound: vi.fn(() => {
    throw new Error("Not found");
  }),
  redirect: vi.fn((path: string) => {
    throw new Error(`Redirected to ${path}`);
  }),
}));

vi.mock("@/server/auth/auth-options", () => ({
  authOptions: {},
}));

vi.mock("@/server/matches/match.repository", () => ({
  PrismaMatchRepository: class {},
}));

vi.mock("@/server/matches/match.service", () => ({
  MatchService: class {
    getDetails = getDetails;
  },
}));

import MatchPage from "./page";

const details = {
  tournamentId: "tournament-1",
  tournamentName: "Club Open",
  roundLabel: "Quarts de finale",
  tournamentStatus: "IN_PROGRESS" as const,
  finalSetSuperTiebreak: false,
  match: {
    id: "match-1",
    round: 2,
    position: 0,
    player1: { id: "player-1", name: "Ada Lovelace" },
    player2: { id: "player-2", name: "Grace Hopper" },
    status: "PENDING" as const,
    scoreStatus: "NONE" as const,
    winnerId: null,
    declaredById: null,
    score: null,
    proposedScore: null,
    isBye: false,
    scheduledAt: "2026-10-03T16:30:00.000Z",
    court: "Court 2",
  },
};

describe("MatchPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      expires: "2099-01-01T00:00:00.000Z",
      user: {
        id: "player-1",
        name: "Ada Lovelace",
        email: "ada@example.test",
        role: "MEMBER",
      },
    });
    getDetails.mockResolvedValue(details);
  });

  it("shows a dedicated match page with the result form for its player", async () => {
    const page = await MatchPage({
      params: Promise.resolve({ id: "match-1" }),
    });

    render(page);

    expect(screen.getByRole("heading", { name: "Votre match" })).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Quarts de finale" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Ada Lovelace, set 1")).toBeVisible();
    expect(screen.getByLabelText("Grace Hopper, set 1")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Déclarer le résultat" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Retour au tableau de Club Open" }),
    ).toHaveAttribute("href", "/tournaments/tournament-1");
    expect(getDetails).toHaveBeenCalledWith("match-1");
  });

  it("does not show a result form to a user outside the match", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      expires: "2099-01-01T00:00:00.000Z",
      user: {
        id: "other-user",
        name: "Other User",
        email: "other@example.test",
        role: "MEMBER",
      },
    });

    const page = await MatchPage({
      params: Promise.resolve({ id: "match-1" }),
    });

    render(page);

    expect(
      screen.queryByRole("button", { name: "Déclarer le résultat" }),
    ).not.toBeInTheDocument();
  });

  it("redirects anonymous visitors to the login page", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    await expect(
      MatchPage({ params: Promise.resolve({ id: "match-1" }) }),
    ).rejects.toThrow("Redirected to /login");
    expect(redirect).toHaveBeenCalledWith("/login");
    expect(getDetails).not.toHaveBeenCalled();
  });

  it("renders not found for an unknown match", async () => {
    getDetails.mockRejectedValue(new NotFoundError("Match introuvable."));

    await expect(
      MatchPage({ params: Promise.resolve({ id: "missing" }) }),
    ).rejects.toThrow("Not found");
    expect(notFound).toHaveBeenCalled();
  });
});
