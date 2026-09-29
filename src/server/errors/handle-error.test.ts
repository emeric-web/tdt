import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/server/errors/app-error";
import { handleError } from "@/server/errors/handle-error";

describe("handleError", () => {
  it.each([
    [new BadRequestError(), 400, "BAD_REQUEST"],
    [new ForbiddenError(), 403, "FORBIDDEN"],
    [new NotFoundError(), 404, "NOT_FOUND"],
    [new ConflictError("État incompatible"), 409, "CONFLICT"],
    [new z.ZodError([]), 400, "BAD_REQUEST"],
  ])(
    "maps known errors to the public API format",
    async (error, status, code) => {
      const response = handleError(error);

      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toMatchObject({
        error: {
          code,
          message: expect.any(String),
        },
      });
    },
  );

  it("logs unexpected errors and does not expose their details", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = handleError(new Error("database credentials leaked"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INTERNAL",
        message: "Erreur interne",
      },
    });
    expect(log).toHaveBeenCalledOnce();

    log.mockRestore();
  });
});
