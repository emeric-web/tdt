"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import type { ScoreFormProps } from "@/types/bracket";

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

export function MatchScoreForm({
  matchId,
  player1,
  player2,
  finalSetSuperTiebreak,
  mode = "declare",
  declaredWinnerId,
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

    if (mode !== "contest-score" && !winnerId) {
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
      const isCorrection = mode === "propose-correction";
      const isScoreContest = mode === "contest-score";
      const endpointMode = isCorrection
        ? "propose-correction"
        : isScoreContest
          ? "contest-score"
          : "declare";
      const response = await fetch(`/api/matches/${matchId}/${endpointMode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isScoreContest ? { score } : { winnerId, score }),
      });
      const result: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          isErrorResponse(result)
            ? result.error.message
            : isCorrection
              ? "Impossible de proposer une correction."
              : isScoreContest
                ? "Impossible de contester le score."
                : "Impossible de déclarer le résultat.",
        );
      }

      setSuccessMessage(
        isCorrection
          ? "Correction proposée. Le résultat reste en attente de traitement."
          : isScoreContest
            ? "Contestation du score enregistrée. Le vainqueur reste non validé."
            : "Résultat déclaré, en attente de confirmation.",
      );
      router.refresh();
    } catch (error) {
      console.error(
        mode === "propose-correction"
          ? "Unable to propose a match result correction."
          : mode === "contest-score"
            ? "Unable to contest match score."
            : "Unable to declare match result.",
        error,
      );
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
  const winnerOptions = players.filter(
    (player) => mode !== "propose-correction" || player.id !== declaredWinnerId,
  );

  return (
    <form onSubmit={handleSubmit}>
      <fieldset disabled={isSubmitting}>
        <legend>
          {mode === "propose-correction"
            ? "Proposer l’autre vainqueur et son score"
            : mode === "contest-score"
              ? "Contester le score"
              : "Déclarer le résultat"}
        </legend>
        {mode === "propose-correction" && (
          <p>
            Cette proposition ne valide pas le résultat et ne fait pas avancer
            de joueur.
          </p>
        )}
        {mode === "contest-score" && (
          <p>
            Vainqueur conservé :{" "}
            {players.find((player) => player.id === declaredWinnerId)?.name}.
            Seul le score est contesté ; aucun joueur n’avance.
          </p>
        )}
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
        {mode !== "contest-score" && (
          <label>
            Vainqueur
            <select
              required
              value={winnerId}
              onChange={(event) => setWinnerId(event.target.value)}
            >
              <option value="">Sélectionner un vainqueur</option>
              {winnerOptions.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="submit">
          {isSubmitting
            ? "Envoi…"
            : mode === "propose-correction"
              ? "Proposer la correction"
              : mode === "contest-score"
                ? "Contester le score"
                : "Déclarer le résultat"}
        </button>
      </fieldset>
      {errorMessage && <p role="alert">{errorMessage}</p>}
      {successMessage && <p role="status">{successMessage}</p>}
    </form>
  );
}
