import { describe, expect, it, vi } from "vitest";

import { MatchService } from "@/server/matches/match.service";

describe("MatchService", () => {
  it("lists upcoming matches for the current player", async () => {
    const upcomingMatches = [
      {
        id: "match-1",
        tournamentId: "tournament-1",
        tournamentName: "Club Open",
        round: 2,
        opponentName: "Grace Hopper",
        scheduledAt: "2026-10-03T10:00:00.000Z",
        court: "Court 1",
      },
    ];
    const repository = {
      listUpcomingForPlayer: vi.fn().mockResolvedValue(upcomingMatches),
      getDetails: vi.fn(),
      schedule: vi.fn(),
      declare: vi.fn(),
      confirm: vi.fn(),
      proposeCorrection: vi.fn(),
    };
    const service = new MatchService(repository);

    await expect(service.listUpcomingForPlayer("player-1")).resolves.toEqual(
      upcomingMatches,
    );
    expect(repository.listUpcomingForPlayer).toHaveBeenCalledWith("player-1");
  });

  it("validates and delegates a match schedule", async () => {
    const scheduledMatch = {
      id: "match-1",
      scheduledAt: new Date("2026-10-02T12:30:00.000Z"),
      court: "Court 1",
    };
    const repository = {
      listUpcomingForPlayer: vi.fn(),
      getDetails: vi.fn(),
      schedule: vi.fn().mockResolvedValue(scheduledMatch),
      declare: vi.fn(),
      confirm: vi.fn(),
      proposeCorrection: vi.fn(),
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
    const repository = {
      listUpcomingForPlayer: vi.fn(),
      getDetails: vi.fn(),
      schedule: vi.fn(),
      declare: vi.fn(),
      confirm: vi.fn(),
      proposeCorrection: vi.fn(),
    };
    const service = new MatchService(repository);

    expect(() =>
      service.schedule("match-1", {
        scheduledAt: "not-a-date",
        court: "Court 1",
      }),
    ).toThrow();
    expect(repository.schedule).not.toHaveBeenCalled();
  });

  it("validates and delegates a match result declaration", async () => {
    const declaredMatch = {
      id: "match-1",
      status: "DECLARED",
      scoreStatus: "DECLARED",
      declaredById: "player-1",
      declaredWinnerId: "player-2",
      proposedWinnerId: "player-2",
      winnerId: null,
      score: null,
      proposedScore: [
        { p1: 4, p2: 6 },
        { p1: 6, p2: 3 },
        { p1: 4, p2: 6 },
      ],
    };
    const repository = {
      listUpcomingForPlayer: vi.fn(),
      getDetails: vi.fn(),
      schedule: vi.fn(),
      declare: vi.fn().mockResolvedValue(declaredMatch),
      confirm: vi.fn(),
      proposeCorrection: vi.fn(),
    };
    const service = new MatchService(repository);

    await expect(
      service.declare("match-1", "player-1", {
        winnerId: "player-2",
        score: [
          { p1: 4, p2: 6 },
          { p1: 6, p2: 3 },
          { p1: 4, p2: 6 },
        ],
      }),
    ).resolves.toEqual(declaredMatch);
    expect(repository.declare).toHaveBeenCalledWith("match-1", "player-1", {
      winnerId: "player-2",
      score: [
        { p1: 4, p2: 6 },
        { p1: 6, p2: 3 },
        { p1: 4, p2: 6 },
      ],
    });
  });

  it("rejects an invalid declaration before calling the repository", () => {
    const repository = {
      listUpcomingForPlayer: vi.fn(),
      getDetails: vi.fn(),
      schedule: vi.fn(),
      declare: vi.fn(),
      confirm: vi.fn(),
      proposeCorrection: vi.fn(),
    };
    const service = new MatchService(repository);

    expect(() =>
      service.declare("match-1", "player-1", {
        winnerId: "",
        score: [],
      }),
    ).toThrow();
    expect(repository.declare).not.toHaveBeenCalled();
  });

  it("delegates result confirmation for the current player", async () => {
    const confirmedMatch = {
      id: "match-1",
      status: "VALIDATED",
      scoreStatus: "VALIDATED",
      winnerId: "player-2",
      score: [
        { p1: 4, p2: 6 },
        { p1: 6, p2: 3 },
        { p1: 4, p2: 6 },
      ],
    };
    const repository = {
      listUpcomingForPlayer: vi.fn(),
      getDetails: vi.fn(),
      schedule: vi.fn(),
      declare: vi.fn(),
      confirm: vi.fn().mockResolvedValue(confirmedMatch),
      proposeCorrection: vi.fn(),
    };
    const service = new MatchService(repository);

    await expect(service.confirm("match-1", "player-2")).resolves.toEqual(
      confirmedMatch,
    );
    expect(repository.confirm).toHaveBeenCalledWith("match-1", "player-2");
  });

  it("validates and delegates a proposed alternative result", async () => {
    const correction = {
      winnerId: "player-1",
      score: [
        { p1: 6, p2: 4 },
        { p1: 6, p2: 3 },
      ],
    };
    const proposedMatch = {
      id: "match-1",
      status: "CORRECTION_PROPOSED",
      scoreStatus: "CORRECTION_PROPOSED",
      proposedWinnerId: "player-1",
      proposedScore: correction.score,
    };
    const repository = {
      listUpcomingForPlayer: vi.fn(),
      getDetails: vi.fn(),
      schedule: vi.fn(),
      declare: vi.fn(),
      confirm: vi.fn(),
      proposeCorrection: vi.fn().mockResolvedValue(proposedMatch),
    };
    const service = new MatchService(repository);

    await expect(
      service.proposeCorrection("match-1", "player-2", correction),
    ).resolves.toEqual(proposedMatch);
    expect(repository.proposeCorrection).toHaveBeenCalledWith(
      "match-1",
      "player-2",
      correction,
    );
  });

  it("rejects malformed corrections before calling the repository", () => {
    const repository = {
      listUpcomingForPlayer: vi.fn(),
      getDetails: vi.fn(),
      schedule: vi.fn(),
      declare: vi.fn(),
      confirm: vi.fn(),
      proposeCorrection: vi.fn(),
    };
    const service = new MatchService(repository);

    expect(() =>
      service.proposeCorrection("match-1", "player-2", {
        winnerId: "",
        score: [],
      }),
    ).toThrow();
    expect(repository.proposeCorrection).not.toHaveBeenCalled();
  });
});
