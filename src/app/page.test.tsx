import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({ data: null, status: "unauthenticated" }),
  signOut: vi.fn(),
}));

import Home from "./page";

describe("Home page", () => {
  it("renders the TdT home heading", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: "Gestion de tournois TdT" }),
    ).toBeInTheDocument();
  });
});
