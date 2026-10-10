"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import type { MatchToSchedule } from "@/server/matches/match.repository";

function readErrorMessage(result: unknown): string | null {
  if (
    typeof result === "object" &&
    result !== null &&
    "error" in result &&
    typeof result.error === "object" &&
    result.error !== null &&
    "message" in result.error &&
    typeof result.error.message === "string"
  ) {
    return result.error.message;
  }

  return null;
}

function ScheduleForm({ match }: { match: MatchToSchedule }) {
  const router = useRouter();
  const [scheduledAt, setScheduledAt] = useState("");
  const [court, setCourt] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/matches/${match.id}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledAt: new Date(scheduledAt).toISOString(),
          court,
        }),
      });
      const result: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          readErrorMessage(result) ?? "Impossible de planifier le match.",
        );
      }

      router.refresh();
    } catch (error) {
      console.error("Unable to schedule match.", error);
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
    <form onSubmit={handleSubmit}>
      <fieldset disabled={isSubmitting}>
        <legend>
          {match.tournamentName} : {match.player1?.name ?? "?"} contre{" "}
          {match.player2?.name ?? "?"}
        </legend>
        <label>
          Date et heure
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(event) => setScheduledAt(event.target.value)}
            required
          />
        </label>
        <label>
          Court
          <input
            type="text"
            value={court}
            onChange={(event) => setCourt(event.target.value)}
            maxLength={100}
            required
          />
        </label>
        <button type="submit">
          {isSubmitting ? "Enregistrement…" : "Planifier"}
        </button>
        {errorMessage && <p role="alert">{errorMessage}</p>}
      </fieldset>
    </form>
  );
}

export function ScheduleQueue({ matches }: { matches: MatchToSchedule[] }) {
  if (matches.length === 0) {
    return <p>Aucun match à planifier.</p>;
  }

  return (
    <ul>
      {matches.map((match) => (
        <li key={match.id}>
          <ScheduleForm match={match} />
        </li>
      ))}
    </ul>
  );
}
