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
    };
    const service = new TournamentService(repository);

    await expect(
      service.create({ name: "x", finalSetSuperTiebreak: false }),
    ).rejects.toThrow();
    expect(repository.create).not.toHaveBeenCalled();
  });
});
