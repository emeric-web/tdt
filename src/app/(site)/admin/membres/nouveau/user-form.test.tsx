import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CreateMemberForm } from "./user-form";

describe("CreateMemberForm", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a member and confirms success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "member-1",
          name: "Ada Lovelace",
          email: "ada@example.test",
          role: "MEMBER",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<CreateMemberForm />);
    await user.type(screen.getByLabelText("Nom"), "Ada Lovelace");
    await user.type(
      screen.getByLabelText("Adresse e-mail"),
      "ada@example.test",
    );
    await user.type(
      screen.getByLabelText("Mot de passe provisoire"),
      "a-temporary-password",
    );
    await user.click(screen.getByRole("button", { name: "Créer le compte" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Le compte de Ada Lovelace (ada@example.test) a été créé.",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/users",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Ada Lovelace",
          email: "ada@example.test",
          temporaryPassword: "a-temporary-password",
        }),
      }),
    );
  });

  it("shows the duplicate-email message returned by the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: "CONFLICT",
              message: "Cette adresse e-mail est déjà utilisée.",
            },
          }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const user = userEvent.setup();

    render(<CreateMemberForm />);
    await user.type(screen.getByLabelText("Nom"), "Ada Lovelace");
    await user.type(
      screen.getByLabelText("Adresse e-mail"),
      "ada@example.test",
    );
    await user.type(
      screen.getByLabelText("Mot de passe provisoire"),
      "a-temporary-password",
    );
    await user.click(screen.getByRole("button", { name: "Créer le compte" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Cette adresse e-mail est déjà utilisée.",
    );
  });
});
