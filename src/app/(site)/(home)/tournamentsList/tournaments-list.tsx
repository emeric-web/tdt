"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import styles from "./tournaments-list.module.css";

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

export function TournamentsList({
  isAdmin = false,
  status,
  heading = "Tous les tournois",
}: {
  isAdmin?: boolean;
  currentUserId?: string;
  status?: TournamentStatus;
  heading?: string;
}) {
  const [tournamentPage, setTournamentPage] = useState<TournamentPage | null>(
    null,
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [reloadCount, setReloadCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCurrent = true;

    async function loadTournaments() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch(
          `/api/tournaments?page=${currentPage}&pageSize=20${
            status ? `&status=${status}` : ""
          }`,
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
  }, [currentPage, reloadCount, status]);

  const pageCount = tournamentPage
    ? Math.max(1, Math.ceil(tournamentPage.total / tournamentPage.pageSize))
    : 1;

  return (
    <div className={styles.dashboard}>
      <section className={styles.section} aria-labelledby={`tournaments-heading-${status ?? "all"}`}>
        <div className={styles.sectionHeading}>
          <h2 className={styles.eyebrow} id={`tournaments-heading-${status ?? "all"}`}>
            {heading}
          </h2>
          {!isLoading && tournamentPage && (
            <span className={styles.count}>
              {tournamentPage.total}{" "}
              {tournamentPage.total === 1 ? "tournoi" : "tournois"}
            </span>
          )}
        </div>
        {isLoading && (
          <p className={styles.state} role="status">
            Chargement des tournois…
          </p>
        )}
        {errorMessage && (
          <div className={styles.stateCard}>
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
          <p className={styles.state}>Aucun tournoi pour le moment.</p>
        )}
        {!isLoading && !errorMessage && tournamentPage && (
          <>
            <ul className={styles.list}>
              {tournamentPage.items.map((tournament) => (
                <li className={styles.listItem} key={tournament.id}>
                  <article className={styles.tournamentCard}>
                    <span className={styles.tournamentIcon} aria-hidden="true">
                      ▦
                    </span>
                    <div className={styles.tournamentCopy}>
                      <div className={styles.tournamentTitle}>
                        <h3>{tournament.name}</h3>
                        <span
                          className={styles.status}
                          data-status={tournament.status}
                        >
                          {statusLabels[tournament.status]}
                        </span>
                      </div>
                      {tournament.startDate && (
                        <p className={styles.cardMeta}>
                          Début prévu :{" "}
                          {new Intl.DateTimeFormat("fr-FR", {
                            dateStyle: "long",
                          }).format(new Date(tournament.startDate))}
                        </p>
                      )}
                      <p className={styles.cardMeta}>
                        {tournament.finalSetSuperTiebreak
                          ? "Super tie-break au dernier set"
                          : "Troisième set complet"}
                      </p>
                      <div className={styles.cardActions}>
                        {tournament.status !== "DRAFT" && (
                          <Link href={`/tournoi/${tournament.id}`}>
                            Consulter le tableau et les horaires
                          </Link>
                        )}
                      </div>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
            {pageCount > 1 && (
                <nav
                className={styles.pagination}
                aria-label="Pagination des tournois"
                >
                <button
                    type="button"
                    disabled={currentPage <= 1 || isLoading}
                    onClick={() => setCurrentPage((page) => page - 1)}
                >
                    Page précédente
                </button>
                <span>
                    Page {currentPage} sur {pageCount}
                </span>
                <button
                    type="button"
                    disabled={currentPage >= pageCount || isLoading}
                    onClick={() => setCurrentPage((page) => page + 1)}
                >
                    Page suivante
                </button>
                </nav>
            )}            
          </>
        )}
      </section>
    </div>
  );
}
