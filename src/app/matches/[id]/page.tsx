import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";

import { MatchCard } from "@/components/bracket/MatchCard";
import { ResultConfirmation } from "@/components/bracket/ResultConfirmation";
import { ScoreForm } from "@/components/bracket/ScoreForm";
import { authOptions } from "@/server/auth/auth-options";
import { NotFoundError } from "@/server/errors/app-error";
import { PrismaMatchRepository } from "@/server/matches/match.repository";
import { MatchService } from "@/server/matches/match.service";

type PageProps = {
  params: Promise<{ id: string }>;
};

const matchService = new MatchService(new PrismaMatchRepository());

export default async function MatchPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;
  let details;

  try {
    details = await matchService.getDetails(id);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }

    throw error;
  }

  const { match } = details;
  const canDeclare =
    session.user.role === "MEMBER" &&
    details.tournamentStatus === "IN_PROGRESS" &&
    match.status === "PENDING" &&
    !match.isBye &&
    match.player1 !== null &&
    match.player2 !== null &&
    (match.player1.id === session.user.id ||
      match.player2.id === session.user.id);
  const canConfirm =
    session.user.role === "MEMBER" &&
    details.tournamentStatus === "IN_PROGRESS" &&
    match.status === "DECLARED" &&
    match.scoreStatus === "DECLARED" &&
    match.declaredById !== null &&
    match.declaredById !== session.user.id &&
    (match.player1?.id === session.user.id ||
      match.player2?.id === session.user.id);

  return (
    <main>
      <p>
        <Link href={`/tournaments/${details.tournamentId}`}>
          Retour au tableau de {details.tournamentName}
        </Link>
      </p>
      <p>{details.tournamentName}</p>
      <h1>Votre match</h1>
      <h2>{details.roundLabel}</h2>
      <MatchCard match={match} />
      {details.tournamentStatus === "FINISHED" && (
        <p role="status">Le tournoi est terminé.</p>
      )}
      {canDeclare && match.player1 && match.player2 && (
        <ScoreForm
          matchId={match.id}
          player1={match.player1}
          player2={match.player2}
          finalSetSuperTiebreak={details.finalSetSuperTiebreak}
        />
      )}
      {canConfirm && <ResultConfirmation matchId={match.id} />}
    </main>
  );
}
