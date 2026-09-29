import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { signIn } from "next-auth/react";

import { LoginForm } from "./login-form";

const { replace, refresh } = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

describe("LoginForm", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a credentials session and redirects after successful login", async () => {
    vi.mocked(signIn).mockResolvedValue({
      error: null,
      status: 200,
      ok: true,
      url: "/",
    });
    const user = userEvent.setup();

    render(<LoginForm />);
    await user.type(
      screen.getByLabelText("Adresse e-mail"),
      "ada@example.test",
    );
    await user.type(screen.getByLabelText("Mot de passe"), "correct-password");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "ada@example.test",
      password: "correct-password",
      callbackUrl: "/",
      redirect: false,
    });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows the same error for invalid credentials", async () => {
    vi.mocked(signIn).mockResolvedValue({
      error: "CredentialsSignin",
      status: 401,
      ok: false,
      url: null,
    });
    const user = userEvent.setup();

    render(<LoginForm />);
    await user.type(
      screen.getByLabelText("Adresse e-mail"),
      "ada@example.test",
    );
    await user.type(screen.getByLabelText("Mot de passe"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Adresse e-mail ou mot de passe invalide.",
    );
    expect(replace).not.toHaveBeenCalled();
  });
});
