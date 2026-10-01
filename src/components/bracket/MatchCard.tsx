import styles from "./Bracket.module.css";
import type {
  MatchCardProps,
  MatchStatus,
  PlayerLineProps,
} from "@/types/bracket";

const STATUS_LABEL: Record<MatchStatus, string> = {
  PENDING: "À jouer",
  DECLARED: "En attente de confirmation",
  CORRECTION_PROPOSED: "Correction proposée",
  DISPUTED: "En litige",
  VALIDATED: "Validé",
};

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(date));
}

// Une ligne = nom du joueur + ses jeux set par set, comme sur un tableau ATP.
function PlayerLine({
  player,
  side,
  sets,
  pending,
  isWinner,
  isBye,
}: PlayerLineProps) {
  if (!player) {
    return <p className={styles.empty}>{isBye ? "Exempt" : "À déterminer"}</p>;
  }

  return (
    <p className={`${styles.line} ${isWinner ? styles.winner : ""}`}>
      <span className={styles.name}>
        {player.name}
        {isWinner && <span aria-label="vainqueur"> ✓</span>}
      </span>
      <span
        className={`${styles.sets} ${pending ? styles.muted : ""}`}
        aria-label="jeux par set"
      >
        {sets?.map((set, index) => {
          const games = set[side];
          // Le perdant du 7-6 affiche ses points de tie-break en exposant.
          const lostTiebreak = set.tb !== undefined && games === 6;
          return (
            <span key={index} className={styles.set}>
              {games}
              {lostTiebreak && <sup>{set.tb}</sup>}
            </span>
          );
        })}
      </span>
    </p>
  );
}

export function MatchCard({ match }: MatchCardProps) {
  // Le score affiché est le score retenu s'il existe, sinon le score déclaré (en grisé).
  const shownScore = match.score ?? match.proposedScore;
  const scorePending = match.scoreStatus !== "VALIDATED" && shownScore !== null;

  return (
    <article className={styles.card}>
      <PlayerLine
        player={match.player1}
        side="p1"
        sets={shownScore}
        pending={scorePending}
        isWinner={match.winnerId === match.player1?.id}
        isBye={match.isBye}
      />
      <PlayerLine
        player={match.player2}
        side="p2"
        sets={shownScore}
        pending={scorePending}
        isWinner={match.winnerId === match.player2?.id}
        isBye={match.isBye}
      />
      {scorePending && <p className={styles.pending}>Score à confirmer</p>}
      <p className={styles.meta}>
        <span className={styles.badge} data-status={match.status}>
          {STATUS_LABEL[match.status]}
        </span>
        {match.scheduledAt && (
          <time dateTime={match.scheduledAt}>
            {formatDate(match.scheduledAt)}
          </time>
        )}
        {match.court && <span>· {match.court}</span>}
      </p>
    </article>
  );
}
