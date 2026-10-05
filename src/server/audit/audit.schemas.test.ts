import { describe, expect, it } from "vitest";

import { listAuditSchema } from "@/server/audit/audit.schemas";

describe("listAuditSchema", () => {
  it("coerces pagination values and applies defaults", () => {
    expect(listAuditSchema.parse({ tournamentId: "tournament-1" })).toEqual({
      tournamentId: "tournament-1",
      page: 1,
      pageSize: 20,
    });
    expect(
      listAuditSchema.parse({
        tournamentId: "tournament-1",
        page: "2",
        pageSize: "5",
      }),
    ).toEqual({
      tournamentId: "tournament-1",
      page: 2,
      pageSize: 5,
    });
  });

  it.each([
    {},
    { tournamentId: "" },
    { tournamentId: "tournament-1", page: "0" },
    { tournamentId: "tournament-1", pageSize: "101" },
    { tournamentId: "tournament-1", unexpected: true },
  ])("rejects invalid audit query %#", (query) => {
    expect(listAuditSchema.safeParse(query).success).toBe(false);
  });
});
