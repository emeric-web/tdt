import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ManageParticipants } from "./participants";

const participantPage = (
  items: unknown[],
  status: "DRAFT" | "IN_PROGRESS" | "FINISHED" = "DRAFT",
  canEdit = status === "DRAFT",
) => Response.json({ status, canEdit, items });
const memberPage = (items: unknown[]) =>
  Response.json({ items, page: 1, pageSize: 100, total: items.length });

describe("ManageParticipants", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("registers a member with a seed and refreshes the participant list", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(participantPage([]))
      .mockResolvedValueOnce(
        memberPage([
          {
            id: "user-1",
            name: "Ada Lovelace",
            email: "ada@example.test",
            role: "MEMBER",
          },
        ]),
      )
      .mockResolvedValueOnce(
        Response.json(
          {
            id: "participant-1",
            tournamentId: "tournament-1",
            userId: "user-1",
            name: "Ada Lovelace",
            seed: 11,
          },
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(
        participantPage([
          {
            id: "participant-1",
            tournamentId: "tournament-1",
            userId: "user-1",
            name: "Ada Lovelace",
            seed: 11,
          },
        ]),
      )
      .mockResolvedValueOnce(
        memberPage([
          {
            id: "user-1",
            name: "Ada Lovelace",
            email: "ada@example.test",
            role: "MEMBER",
          },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<ManageParticipants tournamentId="tournament-1" />);

    await screen.findByRole("option", {
      name: "Ada Lovelace (ada@example.test)",
    });
    await user.type(screen.getByLabelText("Tête de série (facultative)"), "11");
    await user.click(
      screen.getByRole("button", { name: "Inscrire le membre" }),
    );

    expect(
      await screen.findByText("Le membre a été inscrit au tournoi."),
    ).toBeVisible();
    expect(await screen.findByText(/Tête de série no 11/)).toBeVisible();
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/tournaments/tournament-1/participants",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ userId: "user-1", seed: 11 }),
      }),
    );
  });

  it("updates and persists the seed of an existing participant", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        participantPage([
          {
            id: "participant-1",
            tournamentId: "tournament-1",
            userId: "user-1",
            name: "Ada Lovelace",
            seed: null,
          },
        ]),
      )
      .mockResolvedValueOnce(memberPage([]))
      .mockResolvedValueOnce(
        Response.json({
          id: "participant-1",
          tournamentId: "tournament-1",
          userId: "user-1",
          name: "Ada Lovelace",
          seed: 25,
        }),
      )
      .mockResolvedValueOnce(
        participantPage([
          {
            id: "participant-1",
            tournamentId: "tournament-1",
            userId: "user-1",
            name: "Ada Lovelace",
            seed: 25,
          },
        ]),
      )
      .mockResolvedValueOnce(memberPage([]));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<ManageParticipants tournamentId="tournament-1" />);

    const seedInput = await screen.findByLabelText("Tête de série", {
      selector: "input",
    });
    await user.type(seedInput, "25");
    await user.click(
      screen.getByRole("button", { name: "Enregistrer la tête de série" }),
    );

    expect(
      await screen.findByText("La tête de série a été mise à jour."),
    ).toBeVisible();
    expect(await screen.findByText(/Tête de série no 25/)).toBeVisible();
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/tournaments/tournament-1/participants/participant-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ seed: 25 }),
      }),
    );
  });

  it("hides registration and seed editing after the tournament leaves DRAFT", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          participantPage(
            [
              {
                id: "participant-1",
                tournamentId: "tournament-1",
                userId: "user-1",
                name: "Ada Lovelace",
                seed: 1,
              },
            ],
            "IN_PROGRESS",
            false,
          ),
        )
        .mockResolvedValueOnce(memberPage([])),
    );

    render(<ManageParticipants tournamentId="tournament-1" />);

    expect(
      await screen.findByText(
        "Les inscriptions et têtes de série sont verrouillées après le tirage ou l’activation du tournoi.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Enregistrer la tête de série" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Inscrire le membre" }),
    ).toBeNull();
  });

  it("locks editing after the draw while the tournament remains DRAFT", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          participantPage(
            [
              {
                id: "participant-1",
                tournamentId: "tournament-1",
                userId: "user-1",
                name: "Ada Lovelace",
                seed: 1,
              },
            ],
            "DRAFT",
            false,
          ),
        )
        .mockResolvedValueOnce(memberPage([])),
    );

    render(<ManageParticipants tournamentId="tournament-1" />);

    expect(
      await screen.findByText(
        "Les inscriptions et têtes de série sont verrouillées après le tirage ou l’activation du tournoi.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Enregistrer la tête de série" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Inscrire le membre" }),
    ).toBeNull();
  });

  it("paginates available members", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(participantPage([]))
      .mockResolvedValueOnce(
        Response.json({
          items: [
            {
              id: "user-1",
              name: "Ada",
              email: "ada@example.test",
              role: "MEMBER",
            },
          ],
          page: 1,
          pageSize: 20,
          total: 21,
        }),
      )
      .mockResolvedValueOnce(participantPage([]))
      .mockResolvedValueOnce(
        Response.json({
          items: [
            {
              id: "user-21",
              name: "Zoe",
              email: "zoe@example.test",
              role: "MEMBER",
            },
          ],
          page: 2,
          pageSize: 20,
          total: 21,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<ManageParticipants tournamentId="tournament-1" />);

    await screen.findByRole("option", { name: "Ada (ada@example.test)" });
    await user.click(screen.getByRole("button", { name: "Membres suivants" }));

    expect(
      await screen.findByRole("option", { name: "Zoe (zoe@example.test)" }),
    ).toBeVisible();
    expect(fetchMock).toHaveBeenLastCalledWith("/api/users?page=2&pageSize=20");
  });
});
