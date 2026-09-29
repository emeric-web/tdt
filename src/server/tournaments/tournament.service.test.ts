import { describe, expect, it, vi } from "vitest";

import { TournamentService } from "@/server/tournaments/tournament.service";

describe("TournamentService", () => {
  it("lists tournaments through the injected repository", async () => {
    const tournaments = [
      {
        id: "tournament-1",
        name: "Club Open",
        startDate: null,
        status: "DRAFT" as const,
      },
    ];
    const repository = {
      findAll: vi.fn().mockResolvedValue(tournaments),
    };
    const service = new TournamentService(repository);

    await expect(service.list()).resolves.toEqual(tournaments);
    expect(repository.findAll).toHaveBeenCalledOnce();
  });
});
