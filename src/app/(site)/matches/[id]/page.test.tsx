import { cleanup, render, screen } from "@testing-library/react";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NotFoundError } from "@/server/errors/app-error";

const { getDetails, getDetailsForAdmin } = vi.hoisted(() => ({
  getDetails: vi.fn(),
  getDetailsForAdmin: vi.fn(),
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
    getDetailsForAdmin = getDetailsForAdmin;
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
    declaredWinnerId: null,
    proposedWinnerId: null,
    score: null,
    proposedScore: null,
    isBye: false,
    scheduledAt: "2026-10-03T16:30:00.000Z",
    court: "Court 2",
  },
};

function pageProps(id: string, mode?: string) {
  return {
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve(mode ? { mode } : {}),
  };
}

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
    const page = await MatchPage(pageProps("match-1"));

    render(page);

    expect(
      screen.getByRole("heading", { level: 1, name: "Quarts de finale" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Ada Lovelace, set 1")).toBeVisible();
    expect(screen.getByLabelText("Grace Hopper, set 1")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Déclarer le résultat" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Club Open" }),
    ).toHaveAttribute("href", "/tournoi/tournament-1");
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

    const page = await MatchPage(pageProps("match-1"));

    render(page);

    expect(
      screen.queryByRole("button", { name: "Déclarer le résultat" }),
    ).not.toBeInTheDocument();
  });

  it("offers confirmation to the opponent who did not declare the result", async () => {
    getDetails.mockResolvedValue({
      ...details,
      match: {
        ...details.match,
        status: "DECLARED",
        scoreStatus: "DECLARED",
        declaredById: "player-1",
        declaredWinnerId: "player-2",
        proposedScore: [
          { p1: 4, p2: 6 },
          { p1: 6, p2: 3 },
          { p1: 4, p2: 6 },
        ],
      },
    });
    vi.mocked(getServerSession).mockResolvedValue({
      expires: "2099-01-01T00:00:00.000Z",
      user: {
        id: "player-2",
        name: "Grace Hopper",
        email: "grace@example.test",
        role: "MEMBER",
      },
    });

    const page = await MatchPage(pageProps("match-1"));

    render(page);

    expect(
      screen.getByRole("button", { name: "Confirmer le résultat" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Déclarer le résultat" }),
    ).not.toBeInTheDocument();
  });

  it("lets the opponent propose the alternate winner with a score", async () => {
    getDetails.mockResolvedValue({
      ...details,
      match: {
        ...details.match,
        status: "DECLARED",
        scoreStatus: "DECLARED",
        declaredById: "player-1",
        declaredWinnerId: "player-1",
        proposedWinnerId: "player-1",
        proposedScore: [
          { p1: 6, p2: 4 },
          { p1: 6, p2: 3 },
        ],
      },
    });
    vi.mocked(getServerSession).mockResolvedValue({
      expires: "2099-01-01T00:00:00.000Z",
      user: {
        id: "player-2",
        name: "Grace Hopper",
        email: "grace@example.test",
        role: "MEMBER",
      },
    });

    const page = await MatchPage(pageProps("match-1"));

    render(page);

    expect(
      screen.getByRole("group", {
        name: "Proposer l’autre vainqueur et son score",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Proposer la correction" }),
    ).toBeVisible();
    expect(screen.getByRole("option", { name: "Grace Hopper" })).toBeVisible();
    expect(
      screen.queryByRole("option", { name: "Ada Lovelace" }),
    ).not.toBeInTheDocument();
  });

  it("does not offer a correction proposal to the original declarant", async () => {
    getDetails.mockResolvedValue({
      ...details,
      match: {
        ...details.match,
        status: "DECLARED",
        scoreStatus: "DECLARED",
        declaredById: "player-1",
        declaredWinnerId: "player-1",
      },
    });

    const page = await MatchPage(pageProps("match-1"));

    render(page);

    expect(
      screen.queryByRole("button", { name: "Proposer la correction" }),
    ).not.toBeInTheDocument();
  });

  it("does not offer confirmation to the player who declared the result", async () => {
    getDetails.mockResolvedValue({
      ...details,
      match: {
        ...details.match,
        status: "DECLARED",
        scoreStatus: "DECLARED",
        declaredById: "player-1",
      },
    });

    const page = await MatchPage(pageProps("match-1"));

    render(page);

    expect(
      screen.queryByRole("button", { name: "Confirmer le résultat" }),
    ).not.toBeInTheDocument();
  });

  it("does not offer result actions when the tournament is finished", async () => {
    getDetails.mockResolvedValue({
      ...details,
      tournamentStatus: "FINISHED",
    });

    const page = await MatchPage(pageProps("match-1"));

    render(page);

    expect(
      screen.queryByRole("button", { name: "Déclarer le résultat" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Confirmer le résultat" }),
    ).not.toBeInTheDocument();
  });

  it("shows the arbitration form to an admin in admin mode", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      expires: "2099-01-01T00:00:00.000Z",
      user: {
        id: "admin-1",
        name: "Admin",
        email: "admin@example.test",
        role: "ADMIN",
      },
    });
    getDetailsForAdmin.mockResolvedValue({
      ...details,
      match: {
        ...details.match,
        status: "DISPUTED",
        declaredWinnerId: "player-1",
        declaredScore: [
          { p1: 6, p2: 4 },
          { p1: 6, p2: 3 },
        ],
      },
    });

    render(await MatchPage(pageProps("match-1", "admin")));

    expect(
      screen.getByRole("button", { name: "Valider l’arbitrage" }),
    ).toBeVisible();
    expect(getDetailsForAdmin).toHaveBeenCalledWith("match-1");
    expect(getDetails).not.toHaveBeenCalled();
  });

  it("redirects a member who requests admin mode", async () => {
    await expect(MatchPage(pageProps("match-1", "admin"))).rejects.toThrow(
      "Redirected to /matches/match-1",
    );

    expect(redirect).toHaveBeenCalledWith("/matches/match-1");
    expect(getDetailsForAdmin).not.toHaveBeenCalled();
  });

  it("redirects anonymous visitors to the login page", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    await expect(MatchPage(pageProps("match-1"))).rejects.toThrow(
      "Redirected to /connexion",
    );
    expect(redirect).toHaveBeenCalledWith("/connexion");
    expect(getDetails).not.toHaveBeenCalled();
  });

  it("renders not found for an unknown match", async () => {
    getDetails.mockRejectedValue(new NotFoundError("Match introuvable."));

    await expect(MatchPage(pageProps("missing"))).rejects.toThrow("Not found");
    expect(notFound).toHaveBeenCalled();
  });
});
