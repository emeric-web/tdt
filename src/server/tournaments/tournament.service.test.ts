import { describe, expect, it, vi } from "vitest";

import { TournamentService } from "@/server/tournaments/tournament.service";

describe("TournamentService", () => {
  it("lists a page of tournaments through the injected repository", async () => {
    const result = {
      items: [
        {
          id: "tournament-1",
          name: "Club Open",
          startDate: null,
          status: "DRAFT" as const,
          finalSetSuperTiebreak: false,
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
    };
    const repository = {
      findPage: vi.fn().mockResolvedValue(result),
      create: vi.fn(),
      listParticipants: vi.fn(),
      addParticipant: vi.fn(),
      updateParticipantSeed: vi.fn(),
      draw: vi.fn(),
      getBracket: vi.fn(),
      removeParticipant: vi.fn(),
      activate: vi.fn(),
    };
    const service = new TournamentService(repository);

    await expect(service.list()).resolves.toEqual(result);
    expect(repository.findPage).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
    });
  });

  it("creates a tournament with validated data", async () => {
    const tournament = {
      id: "tournament-1",
      name: "Club Open",
      startDate: null,
      status: "DRAFT" as const,
      finalSetSuperTiebreak: false,
    };
    const repository = {
      findPage: vi.fn(),
      create: vi.fn().mockResolvedValue(tournament),
      listParticipants: vi.fn(),
      addParticipant: vi.fn(),
      updateParticipantSeed: vi.fn(),
      draw: vi.fn(),
      getBracket: vi.fn(),
      removeParticipant: vi.fn(),
      activate: vi.fn(),
    };
    const service = new TournamentService(repository);

    await expect(
      service.create({
        name: " Club Open ",
        finalSetSuperTiebreak: false,
      }),
    ).resolves.toEqual(tournament);
    expect(repository.create).toHaveBeenCalledWith({
      name: "Club Open",
      finalSetSuperTiebreak: false,
    });
  });

  it("does not create a tournament from invalid data", async () => {
    const repository = {
      findPage: vi.fn(),
      create: vi.fn(),
      listParticipants: vi.fn(),
      addParticipant: vi.fn(),
      updateParticipantSeed: vi.fn(),
      draw: vi.fn(),
      getBracket: vi.fn(),
      removeParticipant: vi.fn(),
      activate: vi.fn(),
    };
    const service = new TournamentService(repository);

    await expect(
      service.create({ name: "x", finalSetSuperTiebreak: false }),
    ).rejects.toThrow();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("adds participants after validating their seed", async () => {
    const participant = {
      id: "participant-1",
      userId: "user-1",
      name: "Ada",
      seed: 1,
    };
    const repository = {
      findPage: vi.fn(),
      create: vi.fn(),
      listParticipants: vi.fn(),
      addParticipant: vi.fn().mockResolvedValue(participant),
      updateParticipantSeed: vi.fn(),
      draw: vi.fn(),
      getBracket: vi.fn(),
      removeParticipant: vi.fn(),
      activate: vi.fn(),
    };
    const service = new TournamentService(repository);

    await expect(
      service.addParticipant("tournament-1", { userId: "user-1", seed: 1 }),
    ).resolves.toEqual(participant);
    expect(repository.addParticipant).toHaveBeenCalledWith("tournament-1", {
      userId: "user-1",
      seed: 1,
    });
  });

  it("updates or clears a participant seed after validation", async () => {
    const participant = {
      id: "participant-1",
      userId: "user-1",
      name: "Ada",
      seed: null,
    };
    const repository = {
      findPage: vi.fn(),
      create: vi.fn(),
      listParticipants: vi.fn(),
      addParticipant: vi.fn(),
      updateParticipantSeed: vi.fn().mockResolvedValue(participant),
      draw: vi.fn(),
      getBracket: vi.fn(),
      removeParticipant: vi.fn(),
      activate: vi.fn(),
    };
    const service = new TournamentService(repository);

    await expect(
      service.updateParticipantSeed("tournament-1", "participant-1", {
        seed: null,
      }),
    ).resolves.toEqual(participant);
    expect(repository.updateParticipantSeed).toHaveBeenCalledWith(
      "tournament-1",
      "participant-1",
      null,
    );
  });

  it("delegates the draw to the repository", async () => {
    const matches = [
      {
        id: "match-1",
        round: 1,
        position: 0,
        player1Id: "participant-1",
        player2Id: "participant-2",
        winnerId: null,
        isBye: false,
        nextMatchId: null,
        nextSlot: null,
      },
    ];
    const repository = {
      findPage: vi.fn(),
      create: vi.fn(),
      listParticipants: vi.fn(),
      addParticipant: vi.fn(),
      updateParticipantSeed: vi.fn(),
      draw: vi.fn().mockResolvedValue(matches),
      getBracket: vi.fn(),
      removeParticipant: vi.fn(),
      activate: vi.fn(),
    };
    const service = new TournamentService(repository);

    await expect(service.draw("tournament-1", "actor-1")).resolves.toEqual(
      matches,
    );
    expect(repository.draw).toHaveBeenCalledWith("tournament-1", "actor-1");
  });

  it("delegates participant removal to the repository", async () => {
    const repository = {
      findPage: vi.fn(),
      create: vi.fn(),
      listParticipants: vi.fn(),
      addParticipant: vi.fn(),
      updateParticipantSeed: vi.fn(),
      draw: vi.fn(),
      getBracket: vi.fn(),
      removeParticipant: vi.fn().mockResolvedValue(undefined),
      activate: vi.fn(),
    };
    const service = new TournamentService(repository);

    await expect(
      service.removeParticipant("tournament-1", "participant-1"),
    ).resolves.toBeUndefined();
    expect(repository.removeParticipant).toHaveBeenCalledWith(
      "tournament-1",
      "participant-1",
    );
  });

  it("delegates activation to the repository", async () => {
    const tournament = {
      id: "tournament-1",
      name: "Club Open",
      startDate: null,
      status: "IN_PROGRESS" as const,
      finalSetSuperTiebreak: false,
    };
    const repository = {
      findPage: vi.fn(),
      create: vi.fn(),
      listParticipants: vi.fn(),
      addParticipant: vi.fn(),
      updateParticipantSeed: vi.fn(),
      draw: vi.fn(),
      getBracket: vi.fn(),
      removeParticipant: vi.fn(),
      activate: vi.fn().mockResolvedValue(tournament),
    };
    const service = new TournamentService(repository);

    await expect(service.activate("tournament-1", "actor-1")).resolves.toEqual(
      tournament,
    );
    expect(repository.activate).toHaveBeenCalledWith("tournament-1", "actor-1");
  });
});
