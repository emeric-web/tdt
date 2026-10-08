import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";

import { MatchCard } from "@/app/(site)/_components/matchCard/match-card";
import { MatchScoreConfirmationBtn } from "./match-score-confirmation-btn"; 
import { MatchScoreForm } from "./match-score-form";
import { MatchRulingAdmin } from "./match-ruling-admin";

import { authOptions } from "@/server/auth/auth-options";
import { NotFoundError } from "@/server/errors/app-error";
import { AdminMatchDetails, MatchDetails, PrismaMatchRepository } from "@/server/matches/match.repository";
import { MatchService } from "@/server/matches/match.service";

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

  let adminDetails: AdminMatchDetails | null = null;
  let details: MatchDetails;
  
  try {
    if (isAdminMode) {
      adminDetails = await matchService.getDetailsForAdmin(id);
      details = adminDetails;
    } else {
      details = await matchService.getDetails(id);
    }
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  const { match } = details;
  const isParticipant = match.player1?.id === session.user.id || match.player2?.id === session.user.id;
  
  const canDeclare = isParticipant &&
    details.tournamentStatus === "IN_PROGRESS" &&
    match.status === "PENDING" &&
    !match.isBye;

  const canReview = isParticipant &&
    details.tournamentStatus === "IN_PROGRESS" &&
    match.status === "DECLARED" &&
    match.scoreStatus === "DECLARED" &&
    match.declaredById !== null &&
    match.declaredById !== session.user.id;

  const proposedWinner = [match.player1, match.player2].find(
    (player) => player?.id === match.proposedWinnerId,
  );
  const proposedWinnerName = proposedWinner?.name;

  if (match.status === "CORRECTION_PROPOSED" && !proposedWinnerName) {
    throw new Error("Le vainqueur proposé du match est introuvable.");
  }
  console.log(details);

  return (
    <main>
      <p>
        <Link href={`/tournoi/${details.tournamentId}`}>
          {details.tournamentName}
        </Link>
      </p>
      <h1>{details.roundLabel}</h1>
      <MatchCard match={match} />
      {match.status === "CORRECTION_PROPOSED" && (
        <p role="status">
          Correction proposée.
        </p>
      )}
      {canDeclare && match.player1 && match.player2 && (
        <MatchScoreForm
          matchId={match.id}
          player1={match.player1}
          player2={match.player2}
          finalSetSuperTiebreak={details.finalSetSuperTiebreak}
        />
      )}
      {canReview && <MatchScoreConfirmationBtn matchId={match.id} />}
      {canReview &&
        match.player1 &&
        match.player2 &&
        match.declaredWinnerId && (
          <MatchScoreForm
            matchId={match.id}
            player1={match.player1}
            player2={match.player2}
            finalSetSuperTiebreak={details.finalSetSuperTiebreak}
            mode="propose-correction"
            declaredWinnerId={match.declaredWinnerId}
          />
        )}
      {isAdminMode && adminDetails &&
        <MatchRulingAdmin match={{
          ...adminDetails.match,
          tournamentId: adminDetails.tournamentId,
          tournamentName: adminDetails.tournamentName,
          finalSetSuperTiebreak: adminDetails.finalSetSuperTiebreak,
        }} />
      }
    </main>
  );
}
