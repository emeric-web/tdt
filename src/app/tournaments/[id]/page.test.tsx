import { cleanup, render, screen } from "@testing-library/react";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BracketData } from "@/types/bracket";
import { NotFoundError } from "@/server/errors/app-error";

const { getBracket } = vi.hoisted(() => ({
  getBracket: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
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

vi.mock("@/server/tournaments/tournament.repository", () => ({
  PrismaTournamentRepository: class {},
}));

vi.mock("@/server/tournaments/tournament.service", () => ({
  TournamentService: class {
    getBracket = getBracket;
  },
}));

import TournamentBracketPage from "./page";

const bracket: BracketData = {
  tournament: {
    id: "tournament-1",
    name: "Club Open",
    startDate: null,
    finalSetSuperTiebreak: false,
    status: "IN_PROGRESS",
  },
  rounds: [
    {
      round: 1,
      matches: [
        {
          id: "match-1",
          round: 1,
          position: 0,
          player1: { id: "user-1", name: "Ada Lovelace" },
          player2: { id: "user-2", name: "Alan Turing" },
          status: "PENDING",
          scoreStatus: "NONE",
          winnerId: null,
          declaredById: null,
          score: null,
          proposedScore: null,
          isBye: false,
          scheduledAt: "2026-10-02T10:00:00.000Z",
          court: "Court 1",
        },
      ],
    },
  ],
};

describe("TournamentBracketPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      expires: "2099-01-01T00:00:00.000Z",
      user: {
        id: "member-1",
        name: "Ada Lovelace",
        email: "ada@example.test",
        role: "MEMBER",
      },
    });
    getBracket.mockResolvedValue(bracket);
  });

  it("renders the persisted match schedule for authenticated members", async () => {
    const page = await TournamentBracketPage({
      params: Promise.resolve({ id: "tournament-1" }),
    });

    render(page);

    expect(screen.getByRole("heading", { name: "Club Open" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Tous les matchs sont planifiés.",
    );
    expect(screen.getByText(/Court 1/)).toBeVisible();
    expect(screen.getByRole("time")).toHaveAttribute(
      "datetime",
      "2026-10-02T10:00:00.000Z",
    );
    expect(screen.getByRole("time")).toHaveTextContent(/\d{1,2}:\d{2}/);
    expect(getBracket).toHaveBeenCalledWith("tournament-1");
  });

  it("redirects anonymous visitors to login", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    await expect(
      TournamentBracketPage({
        params: Promise.resolve({ id: "tournament-1" }),
      }),
    ).rejects.toThrow("Redirected to /login");
    expect(redirect).toHaveBeenCalledWith("/login");
    expect(getBracket).not.toHaveBeenCalled();
  });

  it("renders not found when the tournament does not exist", async () => {
    getBracket.mockRejectedValue(new NotFoundError("Tournoi introuvable."));

    await expect(
      TournamentBracketPage({
        params: Promise.resolve({ id: "missing" }),
      }),
    ).rejects.toThrow("Not found");
    expect(notFound).toHaveBeenCalled();
  });
});
