"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import type { CorrectionMatch } from "@/server/matches/match.repository";

type ResultKind = "NORMAL" | "ABANDON" | "FORFEIT";

function responseError(value: unknown): string | null {
  if (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "object" &&
    value.error !== null &&
    "message" in value.error &&
    typeof value.error.message === "string"
  ) {
    return value.error.message;
  }
  return null;
}

function ResultCorrectionForm({ match }: { match: CorrectionMatch }) {
  const router = useRouter();
  const [winnerId, setWinnerId] = useState(match.winnerId);
  const [resultKind, setResultKind] = useState<ResultKind>(
    match.resultKind === "ABANDON" || match.resultKind === "FORFEIT"
      ? match.resultKind
      : "NORMAL",
  );
  const [sets, setSets] = useState<string[][]>(() =>
    Array.from({ length: 3 }, (_, index) => {
      const score = match.score?.[index];
      return score ? [String(score.p1), String(score.p2)] : ["", ""];
    }),
  );
  const [reason, setReason] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const players = [match.player1, match.player2].filter(
    (player): player is NonNullable<typeof player> => player !== null,
  );

  async function submitCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    if (!reason.trim()) {
      setErrorMessage("Indiquez le motif de la correction.");
      return;
    }

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
    const scoreWithUnchangedTiebreaks = score.map((set, index) => {
      const previousSet = match.score?.[index];
      return previousSet?.tb !== undefined &&
        previousSet.p1 === set.p1 &&
        previousSet.p2 === set.p2
        ? { ...set, tb: previousSet.tb }
        : set;
    });

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/matches/${match.id}/correct-result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          winnerId,
          score: scoreWithUnchangedTiebreaks,
          resultKind,
          reason: reason.trim(),
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          responseError(result) ?? "Impossible de corriger le résultat.",
        );
      }
      router.refresh();
    } catch (error) {
      console.error("Unable to correct validated match result.", error);
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
    <form onSubmit={submitCorrection}>
      <label>
        Vainqueur
        <select
          value={winnerId}
          required
          disabled={isSubmitting}
          onChange={(event) => setWinnerId(event.target.value)}
        >
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
            const value = event.target.value;
            if (
              value === "NORMAL" ||
              value === "ABANDON" ||
              value === "FORFEIT"
            ) {
              setResultKind(value);
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
          <legend>Score corrigé</legend>
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
                            ? currentSet.map((currentValue, playerIndex) =>
                                playerIndex === side
                                  ? event.target.value
                                  : currentValue,
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
      <label>
        Motif obligatoire
        <textarea
          value={reason}
          maxLength={500}
          required
          disabled={isSubmitting}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      {errorMessage && <p role="alert">{errorMessage}</p>}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Enregistrement…" : "Enregistrer la correction"}
      </button>
    </form>
  );
}

function displayScore(match: CorrectionMatch): string {
  if (match.resultKind === "FORFEIT") {
    return "Forfait";
  }
  return match.score?.map((set) => `${set.p1}-${set.p2}`).join(", ") ?? "—";
}

export function ResultCorrectionQueue({
  matches,
}: {
  matches: CorrectionMatch[];
}) {
  if (matches.length === 0) {
    return <p>Aucun résultat validé n’est actuellement corrigeable.</p>;
  }

  return (
    <section aria-label="Résultats validés pouvant être corrigés">
      {matches.map((match) => (
        <article key={match.id}>
          <h2>
            {match.tournamentName} — match {match.round}.{match.position + 1}
          </h2>
          <p>
            {match.player1?.name ?? "À déterminer"} contre{" "}
            {match.player2?.name ?? "À déterminer"}
          </p>
          <p>
            Vainqueur actuel :{" "}
            {match.player1?.id === match.winnerId
              ? match.player1.name
              : match.player2?.id === match.winnerId
                ? match.player2.name
                : "Inconnu"}
          </p>
          <p>Score actuel : {displayScore(match)}</p>
          <ResultCorrectionForm match={match} />
        </article>
      ))}
    </section>
  );
}
