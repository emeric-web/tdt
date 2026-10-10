import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";

import { MatchCard } from "@/app/(site)/_components/matchCard/match-card";
import { MatchReviewActions } from "./match-review-actions";
import { MatchScoreForm } from "./match-score-form";
import { MatchRulingAdmin } from "./match-ruling-admin";

import { authOptions } from "@/server/auth/auth-options";
import { NotFoundError } from "@/server/errors/app-error";
import { PrismaMatchRepository } from "@/server/matches/match.repository";
import type {
  ArbitrationMatch,
  MatchPageData,
} from "@/server/matches/match.repository";
import { MatchService } from "@/server/matches/match.service";
import type { MatchDto } from "@/types/bracket";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string | string[]}>;
};

const matchService = new MatchService(new PrismaMatchRepository());

export default async function MatchPage({ params, searchParams }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/connexion");
  }

  const { id } = await params;
  const { mode } = await searchParams;

  const isAdminMode = mode === "admin";

  if (isAdminMode && session.user.role !== "ADMIN") {
    redirect(`/matches/${id}`);
  }

  let matchData: MatchPageData;

  try {
    matchData = await matchService.getMatchPageData(id)
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  const [player1, player2] = matchData.players;
  const { result } = matchData;
  const match: MatchDto = {
    id: matchData.id,
    round: matchData.details.round,
    position: matchData.details.position,
    player1,
    player2,
    status: result.status,
    scoreStatus: result.status === "PENDING" ? "NONE" : result.status,
    winnerId: result.winnerId,
    declaredById: result.declared?.byId ?? null,
    declaredWinnerId: result.declared?.winnerId ?? null,
    proposedWinnerId: result.proposed?.winnerId ?? null,
    resultKind: result.kind,
    score: result.score,
    proposedScore: result.proposed?.score ?? null,
    isBye: result.kind === "BYE",
    scheduledAt: matchData.details.scheduledAt,
    court: matchData.details.court,
  };
  const isParticipant = player1?.id === session.user.id || player2?.id === session.user.id;

  const canDeclare = isParticipant &&
    matchData.tournament.status === "IN_PROGRESS" &&
    result.status === "PENDING" &&
    result.kind !== "BYE";

  const canReview = isParticipant &&
    matchData.tournament.status === "IN_PROGRESS" &&
    result.status === "DECLARED" &&
    result.declared !== null &&
    result.declared.byId !== session.user.id;

  const canReviewCorrection = isParticipant &&
    matchData.tournament.status === "IN_PROGRESS" &&
    result.status === "CORRECTION_PROPOSED" &&
    result.proposed !== null &&
    result.declared!.byId === session.user.id;

  const arbitrationMatch: ArbitrationMatch | null = isAdminMode
    ? {
        id: matchData.id,
        tournamentId: matchData.tournament.id,
        tournamentName: matchData.tournament.name,
        round: matchData.details.round,
        position: matchData.details.position,
        status: result.status,
        scoreStatus: match.scoreStatus,
        declaredWinnerId: result.declared?.winnerId ?? null,
        proposedWinnerId: result.proposed?.winnerId ?? null,
        declaredScore: result.declared?.score ?? null,
        proposedScore: result.proposed?.score ?? null,
        player1,
        player2,
        finalSetSuperTiebreak: matchData.tournament.finalSetSuperTiebreak,
      }
    : null;

  return (
    <main>
      <p>
        <Link href={`/tournoi/${matchData.tournament.id}`}>
          {matchData.tournament.name}
        </Link>
      </p>
      <h1>{matchData.roundLabel}</h1>
      <MatchCard match={match} />
      {result.status === "CORRECTION_PROPOSED" && (
        <p role="status">
          Correction proposée.
        </p>
      )}
      {canDeclare && match.player1 && match.player2 && (
        <MatchScoreForm
          matchId={match.id}
          player1={match.player1}
          player2={match.player2}
          finalSetSuperTiebreak={matchData.tournament.finalSetSuperTiebreak}
        />
      )}

      {(canReviewCorrection || canReview) && (
        <MatchReviewActions
          canReview={canReview}
          canReviewCorrection={canReviewCorrection}
          matchId={match.id}
          player1={match.player1}
          player2={match.player2}
          finalSetSuperTiebreak={matchData.tournament.finalSetSuperTiebreak}
        />
      )}

      {arbitrationMatch && <MatchRulingAdmin match={arbitrationMatch} />}
    </main>
  );
}
