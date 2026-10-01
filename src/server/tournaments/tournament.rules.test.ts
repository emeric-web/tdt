import { describe, expect, it } from "vitest";

import { ConflictError } from "@/server/errors/app-error";
import {
  guardActivation,
  guardDraw,
  guardParticipantsMutation,
} from "@/server/tournaments/tournament.rules";

describe("guardParticipantsMutation", () => {
  it("allows participant changes while the tournament is in DRAFT", () => {
    expect(() => guardParticipantsMutation("DRAFT")).not.toThrow();
  });

  it.each(["IN_PROGRESS", "FINISHED"] as const)(
    "rejects changes when tournament status is %s",
    (status) => {
      expect(() => guardParticipantsMutation(status)).toThrow(ConflictError);
    },
  );
});

describe("guardDraw", () => {
  it("allows drawing or redrawing a DRAFT tournament", () => {
    expect(() => guardDraw("DRAFT")).not.toThrow();
  });

  it.each(["IN_PROGRESS", "FINISHED"] as const)(
    "rejects the draw when tournament status is %s",
    (status) => {
      expect(() => guardDraw(status)).toThrow(ConflictError);
    },
  );
});

describe("guardActivation", () => {
  it("allows activation of a drawn DRAFT tournament", () => {
    expect(() => guardActivation("DRAFT", true)).not.toThrow();
  });

  it("rejects activation before a draw", () => {
    expect(() => guardActivation("DRAFT", false)).toThrow(ConflictError);
  });

  it.each(["IN_PROGRESS", "FINISHED"] as const)(
    "rejects activation when tournament status is %s",
    (status) => {
      expect(() => guardActivation(status, true)).toThrow(ConflictError);
    },
  );
});
