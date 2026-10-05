import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import LegalNoticePage from "./mentions-legales/page";
import PrivacyPolicyPage from "./politique-confidentialite/page";

describe("legal information pages", () => {
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

  it("explains data processing and retained match history after account anonymization", () => {
    render(<PrivacyPolicyPage />);

    expect(
      screen.getByRole("heading", { name: "Politique de confidentialité" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/cookie technique/)).toBeInTheDocument();
    expect(
      screen.getByText(/l’identifiant interne est conservé/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Durée de conservation/)).toBeInTheDocument();
  });
});
