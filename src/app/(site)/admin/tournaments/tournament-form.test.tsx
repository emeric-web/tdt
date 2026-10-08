import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CreateTournamentForm } from "./tournament-form";

describe("CreateTournamentForm", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a tournament with the configured format and confirms success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        {
          id: "tournament-1",
          name: "Club Open",
          startDate: null,
          finalSetSuperTiebreak: false,
          status: "DRAFT",
        },
        { status: 201 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<CreateTournamentForm />);
    await user.type(screen.getByLabelText("Nom du tournoi"), "Club Open");
    fireEvent.change(screen.getByLabelText("Date de début (facultative)"), {
      target: { value: "2026-10-15T10:00" },
    });
    await user.click(
      screen.getByLabelText(
        "Utiliser un super tie-break à la place du troisième set",
      ),
    );
    await user.click(screen.getByRole("button", { name: "Créer le tournoi" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Le tournoi « Club Open » a été créé en préparation.",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tournaments",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Club Open",
          startDate: new Date("2026-10-15T10:00").toISOString(),
          finalSetSuperTiebreak: true,
        }),
      }),
    );
  });

  it("shows validation messages returned by the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            error: {
              code: "BAD_REQUEST",
              message: "Données invalides",
            },
          },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();

    render(<CreateTournamentForm />);
    await user.type(screen.getByLabelText("Nom du tournoi"), "Club Open");
    await user.click(screen.getByRole("button", { name: "Créer le tournoi" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Données invalides",
    );
  });
});
