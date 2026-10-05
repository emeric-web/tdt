"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

type ApiErrorResponse = {
  error?: {
    message?: string;
  };
};

function isApiErrorResponse(result: unknown): result is ApiErrorResponse {
  return (
    typeof result === "object" &&
    result !== null &&
    "error" in result &&
    typeof result.error === "object" &&
    result.error !== null
  );
}

export function AnonymizeAccountButton() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleAnonymize() {
    setErrorMessage(null);

    if (
      !window.confirm(
        "Cette action est irréversible. Votre nom et votre e-mail seront anonymisés et vous serez déconnecté. Vos résultats resteront dans l’historique. Continuer ?",
      )
    ) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/users/me", { method: "DELETE" });

      if (!response.ok) {
        const result: unknown = await response.json();
        setErrorMessage(
          isApiErrorResponse(result) &&
            typeof result.error?.message === "string"
            ? result.error.message
            : "Impossible d’anonymiser le compte.",
        );
        return;
      }

      await signOut({ callbackUrl: "/login" });
    } catch (error) {
      console.error("Unable to anonymize member account.", error);
      setErrorMessage("Impossible de contacter le serveur. Réessayez.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={handleAnonymize} disabled={isSubmitting}>
        {isSubmitting
          ? "Anonymisation…"
          : "Demander la suppression de mon compte"}
      </button>
      {errorMessage && <p role="alert">{errorMessage}</p>}
    </div>
  );
}
