import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ManageParticipants } from "./participants";

const participantPage = (
  items: unknown[],
  status: "DRAFT" | "IN_PROGRESS" | "FINISHED" = "DRAFT",
  canEdit = status === "DRAFT",
  hasDraw = false,
) => Response.json({ status, canEdit, hasDraw, items });
const memberPage = (items: unknown[]) =>
  Response.json({ items, page: 1, pageSize: 100, total: items.length });
const bracket = () =>
  Response.json({
    tournament: {
      id: "tournament-1",
      name: "Club Open",
      startDate: null,
      finalSetSuperTiebreak: false,
      status: "DRAFT",
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
            scheduledAt: null,
            court: null,
          },
        ],
      },
    ],
  });

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

  it("disables the draw button with fewer than two participants", async () => {
    vi.stubGlobal(
      "fetch",
      vi
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
        .mockResolvedValueOnce(
          memberPage([
            {
              id: "user-3",
              name: "Grace Hopper",
              email: "grace@example.test",
            },
          ]),
        ),
    );

    render(<ManageParticipants tournamentId="tournament-1" />);

    expect(
      await screen.findByRole("button", { name: "Générer le tableau" }),
    ).toBeDisabled();
  });

  it("draws the bracket and refreshes the participant list", async () => {
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
          {
            id: "participant-2",
            tournamentId: "tournament-1",
            userId: "user-2",
            name: "Alan Turing",
            seed: null,
          },
        ]),
      )
      .mockResolvedValueOnce(
        memberPage([
          {
            id: "user-3",
            name: "Grace Hopper",
            email: "grace@example.test",
          },
        ]),
      )
      .mockResolvedValueOnce(
        Response.json([
          {
            id: "match-1",
            round: 1,
            position: 0,
            player1Id: "user-1",
            player2Id: "user-2",
            winnerId: null,
            isBye: false,
            nextMatchId: null,
            nextSlot: null,
          },
        ]),
      )
      .mockResolvedValueOnce(participantPage([], "DRAFT", true, true))
      .mockResolvedValueOnce(memberPage([]))
      .mockResolvedValueOnce(bracket());
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<ManageParticipants tournamentId="tournament-1" />);

    const drawButton = await screen.findByRole("button", {
      name: "Générer le tableau",
    });
    expect(drawButton).toBeEnabled();
    await user.click(drawButton);

    expect(await screen.findByText("Le tableau a été généré.")).toBeVisible();
    expect(await screen.findByText("Aperçu du tableau")).toBeVisible();
    expect(screen.getByText("Ada Lovelace")).toBeVisible();
    expect(screen.getByText("Alan Turing")).toBeVisible();
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/tournaments/tournament-1/draw",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("schedules a pending match from the bracket preview", async () => {
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
          {
            id: "participant-2",
            tournamentId: "tournament-1",
            userId: "user-2",
            name: "Alan Turing",
            seed: null,
          },
        ]),
      )
      .mockResolvedValueOnce(memberPage([]))
      .mockResolvedValueOnce(
        Response.json([
          {
            id: "match-1",
            round: 1,
            position: 0,
            player1Id: "user-1",
            player2Id: "user-2",
            winnerId: null,
            isBye: false,
            nextMatchId: null,
            nextSlot: null,
          },
        ]),
      )
      .mockResolvedValueOnce(
        participantPage(
          [
            {
              id: "participant-1",
              tournamentId: "tournament-1",
              userId: "user-1",
              name: "Ada Lovelace",
              seed: null,
            },
            {
              id: "participant-2",
              tournamentId: "tournament-1",
              userId: "user-2",
              name: "Alan Turing",
              seed: null,
            },
          ],
          "DRAFT",
          true,
          true,
        ),
      )
      .mockResolvedValueOnce(memberPage([]))
      .mockResolvedValueOnce(bracket())
      .mockResolvedValueOnce(Response.json({ id: "match-1" }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<ManageParticipants tournamentId="tournament-1" />);
    await user.click(
      await screen.findByRole("button", { name: "Générer le tableau" }),
    );

    const matchSelect = await screen.findByLabelText("Match");
    await user.selectOptions(matchSelect, "match-1");
    fireEvent.change(screen.getByLabelText("Date et heure"), {
      target: { value: "2026-10-02T14:30" },
    });
    await user.type(screen.getByLabelText("Terrain"), "Court 1");
    await user.click(
      screen.getByRole("button", { name: "Enregistrer la planification" }),
    );

    expect(await screen.findByText("Le match a été planifié.")).toBeVisible();
    expect(screen.getByText(/Court 1/)).toBeVisible();
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/matches/match-1/schedule",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          scheduledAt: new Date("2026-10-02T14:30").toISOString(),
          court: "Court 1",
        }),
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
        "Les inscriptions et têtes de série sont verrouillées après l’activation du tournoi.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Enregistrer la tête de série" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Inscrire le membre" }),
    ).toBeNull();
  });

  it("keeps editing available after the draw while the tournament remains DRAFT", async () => {
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
            true,
            true,
          ),
        )
        .mockResolvedValueOnce(
          memberPage([
            {
              id: "user-2",
              name: "Alan Turing",
              email: "alan@example.test",
            },
          ]),
        )
        .mockResolvedValueOnce(bracket()),
    );

    render(<ManageParticipants tournamentId="tournament-1" />);

    expect(
      await screen.findByRole("button", { name: "Inscrire le membre" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Enregistrer la tête de série" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Retirer le participant" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Regénérer le tableau" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Activer le tournoi" }),
    ).toBeVisible();
    expect(screen.getByText("Aperçu du tableau")).toBeVisible();
    expect(screen.getByLabelText("Match")).toBeVisible();
  });

  it("removes a participant and invalidates the current draw", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        participantPage(
          [
            {
              id: "participant-1",
              tournamentId: "tournament-1",
              userId: "user-1",
              name: "Ada Lovelace",
              seed: null,
            },
            {
              id: "participant-2",
              tournamentId: "tournament-1",
              userId: "user-2",
              name: "Alan Turing",
              seed: null,
            },
          ],
          "DRAFT",
          true,
          true,
        ),
      )
      .mockResolvedValueOnce(memberPage([]))
      .mockResolvedValueOnce(bracket())
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        participantPage(
          [
            {
              id: "participant-2",
              tournamentId: "tournament-1",
              userId: "user-2",
              name: "Alan Turing",
              seed: null,
            },
          ],
          "DRAFT",
          true,
          false,
        ),
      )
      .mockResolvedValueOnce(memberPage([]));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<ManageParticipants tournamentId="tournament-1" />);
    const removeButtons = await screen.findAllByRole("button", {
      name: "Retirer le participant",
    });
    await user.click(removeButtons[0]);

    expect(
      await screen.findByText(
        "Le participant a été retiré. Le tableau a été supprimé ; relancez le tirage.",
      ),
    ).toBeVisible();
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "/api/tournaments/tournament-1/participants/participant-1",
      { method: "DELETE" },
    );
    expect(
      await screen.findByRole("button", { name: "Générer le tableau" }),
    ).toBeVisible();
  });

  it("activates the tournament only after an administrator clicks the button", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        participantPage(
          [
            {
              id: "participant-1",
              tournamentId: "tournament-1",
              userId: "user-1",
              name: "Ada Lovelace",
              seed: null,
            },
            {
              id: "participant-2",
              tournamentId: "tournament-1",
              userId: "user-2",
              name: "Alan Turing",
              seed: null,
            },
          ],
          "DRAFT",
          true,
          true,
        ),
      )
      .mockResolvedValueOnce(memberPage([]))
      .mockResolvedValueOnce(bracket())
      .mockResolvedValueOnce(
        Response.json({
          id: "tournament-1",
          name: "Club Open",
          startDate: null,
          status: "IN_PROGRESS",
          finalSetSuperTiebreak: false,
        }),
      )
      .mockResolvedValueOnce(
        participantPage(
          [
            {
              id: "participant-1",
              tournamentId: "tournament-1",
              userId: "user-1",
              name: "Ada Lovelace",
              seed: null,
            },
            {
              id: "participant-2",
              tournamentId: "tournament-1",
              userId: "user-2",
              name: "Alan Turing",
              seed: null,
            },
          ],
          "IN_PROGRESS",
          false,
          true,
        ),
      )
      .mockResolvedValueOnce(memberPage([]))
      .mockResolvedValueOnce(bracket());
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<ManageParticipants tournamentId="tournament-1" />);
    await user.click(
      await screen.findByRole("button", { name: "Activer le tournoi" }),
    );

    expect(await screen.findByText("Le tournoi a été activé.")).toBeVisible();
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "/api/tournaments/tournament-1/activate",
      { method: "POST" },
    );
    expect(
      await screen.findByText(
        "Les inscriptions et têtes de série sont verrouillées après l’activation du tournoi.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Activer le tournoi" }),
    ).not.toBeInTheDocument();
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
