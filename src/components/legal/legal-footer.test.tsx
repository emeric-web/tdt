import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LegalFooter } from "./legal-footer";

describe("LegalFooter", () => {
  afterEach(cleanup);

  it("links to the legal notice and privacy policy", () => {
    render(<LegalFooter />);

    expect(
      screen.getByRole("navigation", { name: "Informations légales" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Mentions légales" }),
    ).toHaveAttribute("href", "/mentions-legales");
    expect(
      screen.getByRole("link", { name: "Politique de confidentialité" }),
    ).toHaveAttribute("href", "/politique-confidentialite");
  });
});
