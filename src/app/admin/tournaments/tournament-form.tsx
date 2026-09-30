"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

type ApiErrorResponse = {
  error?: {
    message?: string;
  };
};

type CreatedTournament = {
  name: string;
  status: "DRAFT";
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

function isCreatedTournament(result: unknown): result is CreatedTournament {
  return (
    typeof result === "object" &&
    result !== null &&
    "name" in result &&
    typeof result.name === "string" &&
    "status" in result &&
    result.status === "DRAFT"
  );
}

export function CreateTournamentForm() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const startDate = formData.get("startDate");

    try {
      const response = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          ...(typeof startDate === "string" && startDate.length > 0
            ? { startDate: new Date(startDate).toISOString() }
            : {}),
          finalSetSuperTiebreak: formData.get("finalSetSuperTiebreak") === "on",
        }),
      });
      const result: unknown = await response.json();

      if (!response.ok) {
        setErrorMessage(
          isApiErrorResponse(result) &&
            typeof result.error?.message === "string"
            ? result.error.message
            : "Impossible de créer le tournoi.",
        );
        return;
      }

      if (!isCreatedTournament(result)) {
        throw new Error("The create-tournament response has an invalid shape.");
      }

      setSuccessMessage(
        `Le tournoi « ${result.name} » a été créé en préparation.`,
      );
      form.reset();
    } catch (error) {
      console.error("Unable to create tournament.", error);
      setErrorMessage("Impossible de contacter le serveur. Réessayez.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Nom du tournoi
        <input
          name="name"
          minLength={3}
          maxLength={80}
          required
          disabled={isSubmitting}
        />
      </label>
      <label>
        Date de début (facultative)
        <input name="startDate" type="datetime-local" disabled={isSubmitting} />
      </label>
      <label>
        <input
          name="finalSetSuperTiebreak"
          type="checkbox"
          disabled={isSubmitting}
        />
        Utiliser un super tie-break à la place du troisième set
      </label>
      {errorMessage && <p role="alert">{errorMessage}</p>}
      {successMessage && <p role="status">{successMessage}</p>}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Création…" : "Créer le tournoi"}
      </button>
      <p>
        <Link href="/">Retour à la liste des tournois</Link>
      </p>
    </form>
  );
}
