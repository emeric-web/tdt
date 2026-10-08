import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import LegalNoticePage from "./page";

describe("legal information page", () => {
  afterEach(cleanup);

  it("shows placeholders for publisher and host information", () => {
    render(<LegalNoticePage />);

    expect(
      screen.getByRole("heading", { name: "Mentions légales" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/nom ou raison sociale de l’éditeur/),
    ).toBeInTheDocument();
    expect(screen.getByText(/coordonnées de l’hébergeur/)).toBeInTheDocument();
  });
});
