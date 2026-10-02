import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForbiddenError } from "@/server/errors/app-error";

const { schedule, requireUserWithRole } = vi.hoisted(() => ({
  schedule: vi.fn(),
  requireUserWithRole: vi.fn(),
}));

vi.mock("@/server/auth/authorization", () => ({
  requireUserWithRole,
}));

vi.mock("@/server/matches/match.repository", () => ({
  PrismaMatchRepository: class {},
}));

vi.mock("@/server/matches/match.service", () => ({
  MatchService: class {
    schedule = schedule;
  },
}));

import { PATCH } from "./route";

const context = { params: Promise.resolve({ id: "match-1" }) };

describe("PATCH /api/matches/[id]/schedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("schedules a match for administrators", async () => {
    requireUserWithRole.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    const result = {
      id: "match-1",
      scheduledAt: "2026-10-02T12:30:00.000Z",
      court: "Court 1",
    };
    schedule.mockResolvedValue(result);

    const response = await PATCH(
      new Request("http://localhost/api/matches/match-1/schedule", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scheduledAt: "2026-10-02T14:30:00+02:00",
          court: "Court 1",
        }),
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(schedule).toHaveBeenCalledWith("match-1", {
      scheduledAt: "2026-10-02T14:30:00+02:00",
      court: "Court 1",
    });
  });

  it("rejects members before scheduling a match", async () => {
    requireUserWithRole.mockRejectedValue(new ForbiddenError());

    const response = await PATCH(
      new Request("http://localhost/api/matches/match-1/schedule", {
        method: "PATCH",
        body: JSON.stringify({
          scheduledAt: "2026-10-02T14:30:00+02:00",
          court: "Court 1",
        }),
      }),
      context,
    );

    expect(response.status).toBe(403);
    expect(schedule).not.toHaveBeenCalled();
  });

  it("returns bad request for malformed JSON", async () => {
    requireUserWithRole.mockResolvedValue({ id: "admin-1", role: "ADMIN" });

    const response = await PATCH(
      new Request("http://localhost/api/matches/match-1/schedule", {
        method: "PATCH",
        body: "{",
      }),
      context,
    );

    expect(response.status).toBe(400);
    expect(schedule).not.toHaveBeenCalled();
  });
});
