import { describe, expect, it } from "vitest";

import { ConflictError } from "@/server/errors/app-error";
import { guardParticipantsMutation } from "@/server/tournaments/tournament.rules";

describe("guardParticipantsMutation", () => {
  it("allows changes only in an undrawn DRAFT tournament", () => {
    expect(() => guardParticipantsMutation("DRAFT", false)).not.toThrow();
  });

  it("rejects changes after the draw even while the tournament remains DRAFT", () => {
    expect(() => guardParticipantsMutation("DRAFT", true)).toThrow(
      ConflictError,
    );
  });

  it.each(["IN_PROGRESS", "FINISHED"] as const)(
    "rejects changes when tournament status is %s",
    (status) => {
      expect(() => guardParticipantsMutation(status, false)).toThrow(
        ConflictError,
      );
    },
  );
});
