"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import styles from "./matchs-list.module.css";

type UpcomingMatch = {
  id: string;
  tournamentId: string;
  tournamentName: string;
  round: number;
  roundLabel: string;
  playerName: string;
  opponentName: string;
  scheduledAt: string | null;
  court: string | null;
};

function isUpcomingMatchList(result: unknown): result is UpcomingMatch[] {
  return (
    Array.isArray(result) &&
    result.every(
      (match) =>
        typeof match === "object" &&
        match !== null &&
        "id" in match &&
        typeof match.id === "string" &&
        "tournamentId" in match &&
        typeof match.tournamentId === "string" &&
        "tournamentName" in match &&
        typeof match.tournamentName === "string" &&
        "round" in match &&
        typeof match.round === "number" &&
        "roundLabel" in match &&
        typeof match.roundLabel === "string" &&
        "playerName" in match &&
        typeof match.playerName === "string" &&
        "opponentName" in match &&
        typeof match.opponentName === "string" &&
        "scheduledAt" in match &&
        (typeof match.scheduledAt === "string" || match.scheduledAt === null) &&
        "court" in match &&
        (typeof match.court === "string" || match.court === null),
    )
  );
}

function formatMatchDate(date: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(date));
}

export function MatchsList({
  currentUserId,
}: {
  isAdmin?: boolean;
  currentUserId?: string;
}) {
  const [upcomingMatches, setUpcomingMatches] = useState<UpcomingMatch[]>([]);
  const [upcomingError, setUpcomingError] = useState<string | null>(null);
  const [upcomingLoading, setUpcomingLoading] = useState(
    currentUserId !== undefined,
  );
  const [upcomingReloadCount, setUpcomingReloadCount] = useState(0);


  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    let isCurrent = true;

    async function loadUpcomingMatches() {
      setUpcomingLoading(true);
      setUpcomingError(null);

      try {
        const response = await fetch("/api/matches/upcoming");
        if (!response.ok) {
          throw new Error(
            `Unable to load upcoming matches (${response.status}).`,
          );
        }

        const result: unknown = await response.json();
        if (!isUpcomingMatchList(result)) {
          throw new Error("Upcoming match response has an invalid shape.");
        }

        if (isCurrent) {
          setUpcomingMatches(result);
        }
      } catch (error) {
        console.error("Unable to load upcoming matches.", error);
        if (isCurrent) {
          setUpcomingError("Impossible de charger vos prochains matchs.");
        }
      } finally {
        if (isCurrent) {
          setUpcomingLoading(false);
        }
      }
    }

    void loadUpcomingMatches();

    return () => {
      isCurrent = false;
    };
  }, [currentUserId, upcomingReloadCount]);

  return (
    <div className={styles.dashboard}>
      {currentUserId && (
        <section
          className={styles.section}
          aria-labelledby="upcoming-matches-heading"
        >
          <div className={styles.sectionHeading}>
            <h2 className={styles.eyebrow} id="upcoming-matches-heading">
              Vos prochains matchs
            </h2>
          </div>
          {upcomingLoading && (
            <p className={styles.state} role="status">
              Chargement des matchs…
            </p>
          )}
          {upcomingError && (
            <div className={styles.stateCard}>
              <p role="alert">{upcomingError}</p>
              <button
                type="button"
                onClick={() => setUpcomingReloadCount((count) => count + 1)}
              >
                Réessayer
              </button>
            </div>
          )}
          {!upcomingLoading &&
            !upcomingError &&
            upcomingMatches.length === 0 && (
              <p className={styles.state}>Aucun match à venir.</p>
            )}
          {!upcomingLoading && !upcomingError && upcomingMatches.length > 0 && (
            <ul className={styles.list}>
              {upcomingMatches.map((match) => (
                <li className={styles.listItem} key={match.id}>
                  <Link
                    className={styles.matchCard}
                    href={`/matches/${match.id}`}
                  >
                    <span className={styles.cardCopy}>
                      <span className={styles.cardMeta}>
                        {match.tournamentName} · {match.roundLabel}
                      </span>
                      <h3>
                        {match.playerName} <span>contre</span>{" "}
                        {match.opponentName}
                      </h3>
                      <span className={styles.cardMeta}>
                        {match.scheduledAt
                          ? formatMatchDate(match.scheduledAt)
                          : "Horaire à confirmer"}
                        {match.court
                          ? ` · ${match.court}`
                          : " · Terrain à confirmer"}
                      </span>
                    </span>
                    <span className={styles.arrow} aria-hidden="true">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
