import { describe, expect, it, vi } from "vitest";

import { MatchService } from "@/server/matches/match.service";

describe("MatchService", () => {
  it("validates and delegates a match schedule", async () => {
    const scheduledMatch = {
      id: "match-1",
      scheduledAt: new Date("2026-10-02T12:30:00.000Z"),
      court: "Court 1",
    };
    const repository = {
      schedule: vi.fn().mockResolvedValue(scheduledMatch),
    };
    const service = new MatchService(repository);

    await expect(
      service.schedule("match-1", {
        scheduledAt: "2026-10-02T14:30:00+02:00",
        court: " Court 1 ",
      }),
    ).resolves.toEqual(scheduledMatch);
    expect(repository.schedule).toHaveBeenCalledWith("match-1", {
      scheduledAt: "2026-10-02T14:30:00+02:00",
      court: "Court 1",
    });
  });

  it("does not call the repository with invalid data", async () => {
    const repository = { schedule: vi.fn() };
    const service = new MatchService(repository);

    expect(() =>
      service.schedule("match-1", {
        scheduledAt: "not-a-date",
        court: "Court 1",
      }),
    ).toThrow();
    expect(repository.schedule).not.toHaveBeenCalled();
  });
});
