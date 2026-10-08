import styles from "./bracket.module.css";
import { MatchCard } from "@/app/(site)/_components/matchCard/match-card";
import { roundLabel } from "@/lib/bracket";
import type { BracketProps } from "@/types/bracket";

export function Bracket({ rounds }: BracketProps) {
  const matches = rounds.flatMap((round) => round.matches);
  const matchesToSchedule = matches.filter(
    (match) =>
      !match.isBye && (match.scheduledAt === null || match.court === null),
  ).length;

  return (
    <div className={styles.root}>
      {matches.length > 0 && (
        <p role="status">
          {matchesToSchedule === 0
            ? "Tous les matchs sont planifiés."
            : `${matchesToSchedule} ${
                matchesToSchedule === 1 ? "match à" : "matchs à"
              } planifier.`}
        </p>
      )}
      <div className={styles.bracket}>
        {rounds.map((round) => (
          <section
            key={round.round}
            className={styles.round}
            aria-labelledby={`round-${round.round}`}
          >
            <h3 id={`round-${round.round}`}>
              {roundLabel(round.round, rounds.length)}
            </h3>
            <ul className={styles.matches}>
              {round.matches.map((match) =>
                // Un exempt avance automatiquement : son match ne se joue jamais et
                // ne s'affiche pas, mais on garde l'emplacement pour l'alignement des
                // traits de connexion avec le tour suivant.
                match.isBye ? (
                  <li key={match.id} className={styles.slot} aria-hidden="true">
                    <span className={styles.connector} />
                  </li>
                ) : (
                  <li key={match.id} className={styles.slot}>
                    <MatchCard match={match} />
                    <span className={styles.connector} />
                  </li>
                ),
              )}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
