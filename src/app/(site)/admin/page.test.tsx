import { cleanup, render, screen } from "@testing-library/react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { listForArbitration, listToSchedule } = vi.hoisted(() => ({
  listForArbitration: vi.fn(),
  listToSchedule: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`Redirected to ${path}`);
  }),
}));
vi.mock("@/server/auth/auth-options", () => ({ authOptions: {} }));
vi.mock("@/server/matches/match.repository", () => ({
  PrismaMatchRepository: class {
    listForArbitration = listForArbitration;
    listToSchedule = listToSchedule;
  },
}));
vi.mock("../(home)/tournamentsList/tournaments-list", () => ({
  TournamentsList: ({ heading }: { heading: string }) => <h2>{heading}</h2>,
}));
vi.mock("./litiges/arbitration-queue", () => ({
  ArbitrationQueue: () => <p>file d’arbitrage</p>,
}));
vi.mock("./matchs-a-plannifier/schedule-queue", () => ({
  ScheduleQueue: () => <p>file de planification</p>,
}));

import Admin from "./page";
import AdminLitigesPage from "./litiges/page";
import AdminMatchsAPlannifierPage from "./matchs-a-plannifier/page";

const admin = {
  expires: "2099-01-01T00:00:00.000Z",
  user: { id: "admin-1", name: "Ada", email: "a@x.test", role: "ADMIN" as const },
};
const member = {
  expires: "2099-01-01T00:00:00.000Z",
  user: { id: "user-1", name: "Bob", email: "b@x.test", role: "MEMBER" as const },
};

const pages = [
  ["Admin", Admin],
  ["Litiges", AdminLitigesPage],
  ["Matchs à planifier", AdminMatchsAPlannifierPage],
] as const;

describe.each(pages)("admin page %s", (_name, Page) => {
  beforeEach(() => {
    vi.clearAllMocks();
    listForArbitration.mockResolvedValue([]);
    listToSchedule.mockResolvedValue([]);
  });

  it("redirects anonymous visitors to the login page", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    await expect(Page()).rejects.toThrow("Redirected to /connexion");
    expect(redirect).toHaveBeenCalledWith("/connexion");
  });

  it("redirects non-admin users to the home page", async () => {
    vi.mocked(getServerSession).mockResolvedValue(member);

    await expect(Page()).rejects.toThrow("Redirected to /");
  });
});

describe("Admin dashboard", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue(admin);
  });

  it("links to the dispute and scheduling pages and to tournament creation", async () => {
    listForArbitration.mockResolvedValue([{ id: "m1" }, { id: "m2" }]);

    render(await Admin());

    expect(screen.getByRole("link", { name: /Litiges/ })).toHaveAttribute(
      "href",
      "/admin/litiges",
    );
    expect(screen.getByText("2 matchs à arbitrer")).toBeVisible();
    expect(
      screen.getByRole("link", { name: /Matchs à planifier/ }),
    ).toHaveAttribute("href", "/admin/matchs-a-plannifier");
    expect(
      screen.getByRole("heading", { name: "Tournois en cours" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Tournois en cours de création" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Créer un nouveau tournoi" }),
    ).toHaveAttribute("href", "/admin/tournoi/nouveau");
    expect(
      screen.getByRole("link", { name: "Créer un compte membre" }),
    ).toHaveAttribute("href", "/admin/membres/nouveau");
    expect(screen.getByRole("link", { name: /Journal d’audit/ })).toHaveAttribute(
      "href",
      "/admin/audit",
    );
    expect(screen.getByRole("link", { name: /Corrections/ })).toHaveAttribute(
      "href",
      "/admin/corrections",
    );
  });

  it("renders the dispute page for an admin", async () => {
    render(await AdminLitigesPage());

    expect(screen.getByRole("heading", { name: "Litiges" })).toBeVisible();
    expect(screen.getByText("file d’arbitrage")).toBeVisible();
  });

  it("renders the scheduling page for an admin", async () => {
    render(await AdminMatchsAPlannifierPage());

    expect(
      screen.getByRole("heading", { name: "Matchs à planifier" }),
    ).toBeVisible();
    expect(screen.getByText("file de planification")).toBeVisible();
  });
});
