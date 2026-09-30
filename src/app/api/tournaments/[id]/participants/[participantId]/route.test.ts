import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForbiddenError } from "@/server/errors/app-error";

const { updateParticipantSeed, requireUserWithRole } = vi.hoisted(() => ({
  updateParticipantSeed: vi.fn(),
  requireUserWithRole: vi.fn(),
}));

vi.mock("@/server/auth/authorization", () => ({
  requireUserWithRole,
}));

vi.mock("@/server/tournaments/tournament.repository", () => ({
  PrismaTournamentRepository: class {},
}));

vi.mock("@/server/tournaments/tournament.service", () => ({
  TournamentService: class {
    updateParticipantSeed = updateParticipantSeed;
  },
}));

import { PATCH } from "./route";

const context = {
  params: Promise.resolve({
    id: "tournament-1",
    participantId: "participant-1",
  }),
};

describe("PATCH /api/tournaments/[id]/participants/[participantId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates the participant seed for administrators", async () => {
    requireUserWithRole.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    updateParticipantSeed.mockResolvedValue({
      id: "participant-1",
      userId: "user-1",
      name: "Ada",
      seed: 2,
    });

    const response = await PATCH(
      new Request(
        "http://localhost/api/tournaments/tournament-1/participants/participant-1",
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ seed: 2 }),
        },
      ),
      context,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ seed: 2 });
    expect(updateParticipantSeed).toHaveBeenCalledWith(
      "tournament-1",
      "participant-1",
      { seed: 2 },
    );
  });

  it("rejects members before updating the seed", async () => {
    requireUserWithRole.mockRejectedValue(new ForbiddenError());

    const response = await PATCH(
      new Request(
        "http://localhost/api/tournaments/tournament-1/participants/participant-1",
        {
          method: "PATCH",
          body: JSON.stringify({ seed: 2 }),
        },
      ),
      context,
    );

    expect(response.status).toBe(403);
    expect(updateParticipantSeed).not.toHaveBeenCalled();
  });
});
