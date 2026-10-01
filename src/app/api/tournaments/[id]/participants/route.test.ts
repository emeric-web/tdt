import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForbiddenError } from "@/server/errors/app-error";

const { listParticipants, addParticipant, requireUserWithRole } = vi.hoisted(
  () => ({
    listParticipants: vi.fn(),
    addParticipant: vi.fn(),
    requireUserWithRole: vi.fn(),
  }),
);

vi.mock("@/server/auth/authorization", () => ({
  requireUserWithRole,
}));

vi.mock("@/server/tournaments/tournament.repository", () => ({
  PrismaTournamentRepository: class {},
}));

vi.mock("@/server/tournaments/tournament.service", () => ({
  TournamentService: class {
    listParticipants = listParticipants;
    addParticipant = addParticipant;
  },
}));

import { GET, POST } from "./route";

const context = { params: Promise.resolve({ id: "tournament-1" }) };

describe("/api/tournaments/[id]/participants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the registered participants to administrators", async () => {
    requireUserWithRole.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    listParticipants.mockResolvedValue({
      status: "DRAFT",
      canEdit: true,
      hasDraw: false,
      items: [{ id: "participant-1", userId: "user-1", name: "Ada", seed: 1 }],
    });

    const response = await GET(
      new Request("http://localhost/api/tournaments/tournament-1/participants"),
      context,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "DRAFT",
      canEdit: true,
      hasDraw: false,
      items: [{ id: "participant-1", userId: "user-1", name: "Ada", seed: 1 }],
    });
    expect(listParticipants).toHaveBeenCalledWith("tournament-1");
  });

  it("rejects members before listing participants", async () => {
    requireUserWithRole.mockRejectedValue(new ForbiddenError());

    const response = await GET(
      new Request("http://localhost/api/tournaments/tournament-1/participants"),
      context,
    );

    expect(response.status).toBe(403);
    expect(listParticipants).not.toHaveBeenCalled();
  });

  it("adds a participant and returns 201", async () => {
    requireUserWithRole.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    addParticipant.mockResolvedValue({
      id: "participant-1",
      userId: "user-1",
      name: "Ada",
      seed: 3,
    });

    const response = await POST(
      new Request(
        "http://localhost/api/tournaments/tournament-1/participants",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userId: "user-1", seed: 3 }),
        },
      ),
      context,
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      userId: "user-1",
      seed: 3,
    });
    expect(addParticipant).toHaveBeenCalledWith("tournament-1", {
      userId: "user-1",
      seed: 3,
    });
  });
});
