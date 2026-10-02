"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import type { BracketPlayer } from "@/types/bracket";

type ScoreFormProps = {
  matchId: string;
  player1: BracketPlayer;
  player2: BracketPlayer;
  finalSetSuperTiebreak: boolean;
};

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

export function ScoreForm({
  matchId,
  player1,
  player2,
  finalSetSuperTiebreak,
}: ScoreFormProps) {
  const router = useRouter();
  const [sets, setSets] = useState<string[][]>([
    ["", ""],
    ["", ""],
    ["", ""],
  ]);
  const [winnerId, setWinnerId] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!winnerId) {
      setErrorMessage("Sélectionnez le vainqueur du match.");
      return;
    }

    const thirdSet = sets[2];
    if ((thirdSet[0] === "") !== (thirdSet[1] === "")) {
      setErrorMessage("Renseignez les deux scores du troisième set.");
      return;
    }

    const setCount = thirdSet.every((games) => games !== "") ? 3 : 2;
    const score = sets.slice(0, setCount).map(([p1, p2]) => ({
      p1: Number(p1),
      p2: Number(p2),
    }));

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/matches/${matchId}/declare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winnerId, score }),
      });
      const result: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          isErrorResponse(result)
            ? result.error.message
            : "Impossible de déclarer le résultat.",
        );
      }

      setSuccessMessage("Résultat déclaré, en attente de confirmation.");
      router.refresh();
    } catch (error) {
      console.error("Unable to declare match result.", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de contacter le serveur. Réessayez.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const players = [player1, player2];

  return (
    <form onSubmit={handleSubmit}>
      <fieldset disabled={isSubmitting}>
        <legend>Déclarer le résultat</legend>
        {[0, 1, 2].map((setIndex) => (
          <fieldset key={setIndex}>
            <legend>
              {setIndex === 2 && finalSetSuperTiebreak
                ? "Super tie-break du troisième set"
                : `Set ${setIndex + 1}${setIndex === 2 ? " (facultatif)" : ""}`}
            </legend>
            {players.map((player, side) => (
              <label key={player.id}>
                {player.name}
                <input
                  aria-label={`${player.name}, ${
                    setIndex === 2 && finalSetSuperTiebreak
                      ? "super tie-break"
                      : `set ${setIndex + 1}`
                  }`}
                  type="number"
                  min="0"
                  step="1"
                  required={setIndex < 2}
                  value={sets[setIndex][side]}
                  onChange={(event) =>
                    setSets((current) =>
                      current.map((set, index) =>
                        index === setIndex
                          ? set.map((value, playerIndex) =>
                              playerIndex === side ? event.target.value : value,
                            )
                          : set,
                      ),
                    )
                  }
                />
              </label>
            ))}
          </fieldset>
        ))}
        <label>
          Vainqueur
          <select
            required
            value={winnerId}
            onChange={(event) => setWinnerId(event.target.value)}
          >
            <option value="">Sélectionner un vainqueur</option>
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">
          {isSubmitting ? "Envoi…" : "Déclarer le résultat"}
        </button>
      </fieldset>
      {errorMessage && <p role="alert">{errorMessage}</p>}
      {successMessage && <p role="status">{successMessage}</p>}
    </form>
  );
}
