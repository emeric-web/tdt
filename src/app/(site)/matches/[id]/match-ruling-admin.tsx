"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import type { ArbitrationMatch } from "@/server/matches/match.repository";

type ResultKind = "NORMAL" | "ABANDON" | "FORFEIT";

function formatScore(score: ArbitrationMatch["proposedScore"]): string {
  return score?.map((set) => `${set.p1}-${set.p2}`).join(", ") ?? "Non saisi";
}

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

function ArbitrationForm({ match }: { match: ArbitrationMatch }) {
  const router = useRouter();
  const initialScore = match.proposedScore ?? match.declaredScore ?? [];
  const [sets, setSets] = useState<string[][]>(() =>
    Array.from({ length: 3 }, (_, index) => {
      const score = initialScore[index];
      return score ? [String(score.p1), String(score.p2)] : ["", ""];
    }),
  );
  const [winnerId, setWinnerId] = useState(
    match.proposedWinnerId ?? match.declaredWinnerId ?? "",
  );
  const [resultKind, setResultKind] = useState<ResultKind>("NORMAL");
  const [reason, setReason] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const players = [match.player1, match.player2].filter(
    (player): player is NonNullable<typeof player> => player !== null,
  );

  async function submitDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const score: { p1: number; p2: number }[] = [];
    if (resultKind !== "FORFEIT") {
      for (const [index, [p1, p2]] of sets.entries()) {
        if ((p1 === "") !== (p2 === "")) {
          setErrorMessage(`Renseignez les deux scores du set ${index + 1}.`);
          return;
        }
        if (p1 !== "" && p2 !== "") {
          if (score.length !== index) {
            setErrorMessage("Renseignez les sets dans l’ordre.");
            return;
          }
          score.push({ p1: Number(p1), p2: Number(p2) });
        }
      }
    }

    if (!winnerId) {
      setErrorMessage("Sélectionnez le vainqueur.");
      return;
    }
    if (
      (resultKind === "ABANDON" || resultKind === "FORFEIT") &&
      !reason.trim()
    ) {
      setErrorMessage("Indiquez le motif de la décision.");
      return;
    }

    const payload ={
      winnerId,
      score,
      resultKind,
      ...(reason.trim() ? { reason } : {}),
    };

    setIsSubmitting(true);
    try {
      const endpoint = "arbitrate";
      const response = await fetch(`/api/matches/${match.id}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          readErrorMessage(result) ?? "Impossible d’enregistrer l’arbitrage.",
        );
      }

      router.refresh();
    } catch (error) {
      console.error("Unable to arbitrate match result.", error);
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
    <form onSubmit={submitDecision}>
      <label>
        Vainqueur définitif
        <select
          value={winnerId}
          required
          disabled={isSubmitting}
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
      <label>
        Type de résultat
        <select
          value={resultKind}
          disabled={isSubmitting}
          onChange={(event) => {
            const nextResultKind = event.target.value;
            if (
              nextResultKind === "NORMAL" ||
              nextResultKind === "ABANDON" ||
              nextResultKind === "FORFEIT"
            ) {
              setResultKind(nextResultKind);
            }
          }}
        >
          <option value="NORMAL">Résultat normal</option>
          <option value="ABANDON">Abandon</option>
          <option value="FORFEIT">Forfait</option>
        </select>
      </label>
      {resultKind !== "FORFEIT" && (
        <fieldset disabled={isSubmitting}>
          <legend>Score retenu</legend>
          {sets.map((set, index) => (
            <fieldset key={index}>
              <legend>Set {index + 1}</legend>
              {players.map((player, side) => (
                <label key={player.id}>
                  {player.name}
                  <input
                    aria-label={`${player.name}, set ${index + 1}`}
                    type="number"
                    min="0"
                    step="1"
                    value={set[side]}
                    onChange={(event) =>
                      setSets((current) =>
                        current.map((currentSet, setIndex) =>
                          setIndex === index
                            ? currentSet.map((value, playerIndex) =>
                                playerIndex === side
                                  ? event.target.value
                                  : value,
                              )
                            : currentSet,
                        ),
                      )
                    }
                  />
                </label>
              ))}
            </fieldset>
          ))}
        </fieldset>
      )}
      {(resultKind === "ABANDON" || resultKind === "FORFEIT") && (
        <label>
          Motif
          <textarea
            value={reason}
            maxLength={500}
            required
            disabled={isSubmitting}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
      )}
      {errorMessage && <p role="alert">{errorMessage}</p>}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Enregistrement…" : "Valider l’arbitrage"}
      </button>
    </form>
  );
}

export function MatchRulingAdmin({ match }: { match: ArbitrationMatch }) {


  return (
    <article key={match.id}>
      <h2>
        {match.tournamentName} — match {match.round}.{match.position + 1}
      </h2>
      <p>
        {match.player1?.name ?? "À déterminer"} contre{" "}
        {match.player2?.name ?? "À déterminer"}
      </p>
      <p>État : {match.status}</p>
      <p>Score proposé : {formatScore(match.proposedScore)}</p>
      <p>
        Vainqueur déclaré :{" "}
        {match.player1?.id === match.declaredWinnerId
          ? match.player1.name
          : match.player2?.id === match.declaredWinnerId
            ? match.player2.name
            : "Non déterminé"}
      </p>
      <ArbitrationForm match={match} />
    </article>
  );
}
