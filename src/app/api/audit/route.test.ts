import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForbiddenError } from "@/server/errors/app-error";

const { list, requireUserWithRole } = vi.hoisted(() => ({
  list: vi.fn(),
  requireUserWithRole: vi.fn(),
}));

vi.mock("@/server/auth/authorization", () => ({ requireUserWithRole }));
vi.mock("@/server/audit/audit.repository", () => ({
  PrismaAuditRepository: class {},
}));
vi.mock("@/server/audit/audit.service", () => ({
  AuditService: class {
    list = list;
  },
}));

import { GET } from "./route";

describe("GET /api/audit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns paginated entries to administrators", async () => {
    requireUserWithRole.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    const page = {
      items: [{ id: "audit-1", action: "ARBITRATE" }],
      page: 2,
      pageSize: 5,
      total: 8,
    };
    list.mockResolvedValue(page);

    const response = await GET(
      new Request(
        "http://localhost/api/audit?tournamentId=tournament-1&page=2&pageSize=5",
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(page);
    expect(list).toHaveBeenCalledWith({
      tournamentId: "tournament-1",
      page: "2",
      pageSize: "5",
    });
    expect(requireUserWithRole).toHaveBeenCalledWith(["ADMIN"]);
  });

  it("rejects non-administrators", async () => {
    requireUserWithRole.mockRejectedValue(new ForbiddenError());

    const response = await GET(
      new Request("http://localhost/api/audit?tournamentId=tournament-1"),
    );

    expect(response.status).toBe(403);
    expect(list).not.toHaveBeenCalled();
  });
});
