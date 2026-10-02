"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function isErrorResponse(value: unknown): value is {
  error: { message: string };
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "object" &&
    value.error !== null &&
    "message" in value.error &&
    typeof value.error.message === "string"
  );
}

export function ResultConfirmation({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function confirmResult() {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/matches/${matchId}/confirm`, {
        method: "POST",
      });
      const result: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          isErrorResponse(result)
            ? result.error.message
            : "Impossible de confirmer le résultat.",
        );
      }

      router.refresh();
    } catch (error) {
      console.error("Unable to confirm match result.", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de contacter le serveur. Réessayez.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <button type="button" disabled={isSubmitting} onClick={confirmResult}>
        {isSubmitting ? "Confirmation…" : "Confirmer le résultat"}
      </button>
      {errorMessage && <p role="alert">{errorMessage}</p>}
    </div>
  );
}
