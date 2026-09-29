import { ZodError } from "zod";

import { AppError } from "@/server/errors/app-error";

export function handleError(error: unknown): Response {
  if (error instanceof ZodError) {
    return Response.json(
      {
        error: {
          code: "BAD_REQUEST",
          message: "Données invalides",
        },
      },
      { status: 400 },
    );
  }

  if (error instanceof AppError) {
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
        },
      },
      { status: error.status },
    );
  }

  console.error(error);

  return Response.json(
    {
      error: {
        code: "INTERNAL",
        message: "Erreur interne",
      },
    },
    { status: 500 },
  );
}
