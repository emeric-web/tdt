import styles from "./Bracket.module.css";
import { MatchCard } from "./MatchCard";
import { roundLabel } from "@/lib/bracket";
import type { BracketProps } from "@/types/bracket";

export function Bracket({ rounds }: BracketProps) {
  return (
    <div className={styles.root}>
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
