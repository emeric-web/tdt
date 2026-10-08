import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import PrivacyPolicyPage from "./page";

describe("privacy information page", () => {
  afterEach(cleanup);

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
