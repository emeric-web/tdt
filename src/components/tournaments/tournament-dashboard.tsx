"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type TournamentStatus = "DRAFT" | "IN_PROGRESS" | "FINISHED";

type Tournament = {
  id: string;
  name: string;
  startDate: string | null;
  status: TournamentStatus;
  finalSetSuperTiebreak: boolean;
};

type TournamentPage = {
  items: Tournament[];
  page: number;
  pageSize: number;
  total: number;
};

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

const statusLabels: Record<TournamentStatus, string> = {
  DRAFT: "En préparation",
  IN_PROGRESS: "En cours",
  FINISHED: "Terminé",
};

function isTournamentPage(result: unknown): result is TournamentPage {
  return (
    typeof result === "object" &&
    result !== null &&
    "items" in result &&
    Array.isArray(result.items) &&
    "page" in result &&
    typeof result.page === "number" &&
    "pageSize" in result &&
    typeof result.pageSize === "number" &&
    "total" in result &&
    typeof result.total === "number" &&
    result.items.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        "id" in item &&
        typeof item.id === "string" &&
        "name" in item &&
        typeof item.name === "string" &&
        "startDate" in item &&
        (typeof item.startDate === "string" || item.startDate === null) &&
        "status" in item &&
        (item.status === "DRAFT" ||
          item.status === "IN_PROGRESS" ||
          item.status === "FINISHED") &&
        "finalSetSuperTiebreak" in item &&
        typeof item.finalSetSuperTiebreak === "boolean",
    )
  );
}

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

export function TournamentDashboard({
  isAdmin = false,
  currentUserId,
}: {
  isAdmin?: boolean;
  currentUserId?: string;
}) {
  const [tournamentPage, setTournamentPage] = useState<TournamentPage | null>(
    null,
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [reloadCount, setReloadCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [upcomingMatches, setUpcomingMatches] = useState<UpcomingMatch[]>([]);
  const [upcomingError, setUpcomingError] = useState<string | null>(null);
  const [upcomingLoading, setUpcomingLoading] = useState(
    currentUserId !== undefined,
  );
  const [upcomingReloadCount, setUpcomingReloadCount] = useState(0);

  useEffect(() => {
    let isCurrent = true;

    async function loadTournaments() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch(
          `/api/tournaments?page=${currentPage}&pageSize=20`,
        );
        if (!response.ok) {
          throw new Error(`Unable to load tournaments (${response.status}).`);
        }

        const result: unknown = await response.json();
        if (!isTournamentPage(result)) {
          throw new Error("The tournament list response has an invalid shape.");
        }

        if (isCurrent) {
          setTournamentPage(result);
        }
      } catch (error) {
        console.error("Unable to load tournaments.", error);
        if (isCurrent) {
          setErrorMessage("Impossible de charger les tournois. Réessayez.");
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    void loadTournaments();

    return () => {
      isCurrent = false;
    };
  }, [currentPage, reloadCount]);

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

  const pageCount = tournamentPage
    ? Math.max(1, Math.ceil(tournamentPage.total / tournamentPage.pageSize))
    : 1;

  return (
    <>
      {currentUserId && (
        <section aria-labelledby="upcoming-matches-heading">
          <h2 id="upcoming-matches-heading">Vos prochains matchs</h2>
          {upcomingLoading && <p role="status">Chargement des matchs…</p>}
          {upcomingError && (
            <div>
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
            upcomingMatches.length === 0 && <p>Aucun match à venir.</p>}
          {!upcomingLoading && !upcomingError && upcomingMatches.length > 0 && (
            <ul>
              {upcomingMatches.map((match) => (
                <li key={match.id}>
                  <Link href={`/matches/${match.id}`}>
                    <article>
                      <p>
                        {match.tournamentName} · {match.roundLabel}
                      </p>
                      <h3>
                        {match.playerName} <span>contre</span>{" "}
                        {match.opponentName}
                      </h3>
                      <p>
                        {match.scheduledAt
                          ? formatMatchDate(match.scheduledAt)
                          : "Horaire à confirmer"}
                        {match.court
                          ? ` · ${match.court}`
                          : " · Terrain à confirmer"}
                      </p>
                    </article>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <section aria-labelledby="tournaments-heading">
        <h2 id="tournaments-heading">Tournois</h2>
        {isLoading && <p role="status">Chargement des tournois…</p>}
        {errorMessage && (
          <div>
            <p role="alert">{errorMessage}</p>
            <button
              type="button"
              onClick={() => setReloadCount((count) => count + 1)}
            >
              Réessayer
            </button>
          </div>
        )}
        {!isLoading && !errorMessage && tournamentPage?.total === 0 && (
          <p>Aucun tournoi pour le moment.</p>
        )}
        {!isLoading && !errorMessage && tournamentPage && (
          <>
            <p>
              {tournamentPage.total}{" "}
              {tournamentPage.total === 1 ? "tournoi" : "tournois"}
            </p>
            <ul>
              {tournamentPage.items.map((tournament) => (
                <li key={tournament.id}>
                  <article>
                    <h3>{tournament.name}</h3>
                    <p>{statusLabels[tournament.status]}</p>
                    {tournament.startDate && (
                      <p>
                        Début prévu :{" "}
                        {new Intl.DateTimeFormat("fr-FR", {
                          dateStyle: "long",
                        }).format(new Date(tournament.startDate))}
                      </p>
                    )}
                    <p>
                      {tournament.finalSetSuperTiebreak
                        ? "Super tie-break au dernier set"
                        : "Troisième set complet"}
                    </p>
                    {isAdmin && (
                      <Link
                        href={`/admin/tournaments/${tournament.id}/participants`}
                      >
                        {tournament.status === "DRAFT"
                          ? "Gérer les inscriptions"
                          : "Consulter les participants"}
                      </Link>
                    )}
                    {tournament.status !== "DRAFT" && (
                      <Link href={`/tournaments/${tournament.id}`}>
                        Consulter le tableau et les horaires
                      </Link>
                    )}
                  </article>
                </li>
              ))}
            </ul>
            <nav aria-label="Pagination des tournois">
              <button
                type="button"
                disabled={currentPage <= 1 || isLoading}
                onClick={() => setCurrentPage((page) => page - 1)}
              >
                Page précédente
              </button>
              <span>
                {" "}
                Page {currentPage} sur {pageCount}{" "}
              </span>
              <button
                type="button"
                disabled={currentPage >= pageCount || isLoading}
                onClick={() => setCurrentPage((page) => page + 1)}
              >
                Page suivante
              </button>
            </nav>
          </>
        )}
      </section>
    </>
  );
}
