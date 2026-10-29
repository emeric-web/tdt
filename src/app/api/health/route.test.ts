import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn() }));

vi.mock("@/server/db/prisma", () => ({ prisma: { $queryRaw: queryRaw } }));

import { GET } from "./route";

describe("GET /api/health", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 when the database answers", async () => {
    queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("returns 503 without leaking details when the database is down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    queryRaw.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5:5432"));

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.text()).toBe('{"status":"error"}');
  });
});
