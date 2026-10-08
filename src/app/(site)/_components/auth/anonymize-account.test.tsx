import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnonymizeAccountButton } from "./anonymize-account";

const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));

vi.mock("next-auth/react", () => ({ signOut }));

describe("AnonymizeAccountButton", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
  });

  it("confirms, anonymizes the account, and signs the member out", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<AnonymizeAccountButton />);
    await user.click(
      screen.getByRole("button", {
        name: "Demander la suppression de mon compte",
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith("/api/users/me", {
      method: "DELETE",
    });
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/connexion" });
  });

  it("does not call the API if the member cancels", async () => {
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<AnonymizeAccountButton />);
    await user.click(
      screen.getByRole("button", {
        name: "Demander la suppression de mon compte",
      }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("shows the server error and preserves the session when anonymization fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: { message: "Compte membre introuvable." } },
            { status: 404 },
          ),
        ),
    );
    const user = userEvent.setup();

    render(<AnonymizeAccountButton />);
    await user.click(
      screen.getByRole("button", {
        name: "Demander la suppression de mon compte",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Compte membre introuvable.",
    );
    expect(signOut).not.toHaveBeenCalled();
  });
});
