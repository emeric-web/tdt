import { describe, expect, it } from "vitest";

import { ConflictError } from "@/server/errors/app-error";
import { guardMatchScheduling } from "@/server/matches/match.rules";

describe("guardMatchScheduling", () => {
  it("allows pending non-bye matches", () => {
    expect(() => guardMatchScheduling("PENDING", false)).not.toThrow();
  });

  it("rejects bye matches", () => {
    expect(() => guardMatchScheduling("PENDING", true)).toThrow(ConflictError);
  });

  it.each([
    "DECLARED",
    "CORRECTION_PROPOSED",
    "DISPUTED",
    "VALIDATED",
  ] as const)("rejects a match with status %s", (status) => {
    expect(() => guardMatchScheduling(status, false)).toThrow(ConflictError);
  });
});
