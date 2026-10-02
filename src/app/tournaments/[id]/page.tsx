import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";

import { authOptions } from "@/server/auth/auth-options";
import { Bracket } from "@/components/bracket/Bracket";
import { NotFoundError } from "@/server/errors/app-error";
import { PrismaTournamentRepository } from "@/server/tournaments/tournament.repository";
import { TournamentService } from "@/server/tournaments/tournament.service";

type PageProps = {
  params: Promise<{ id: string }>;
};

const tournamentService = new TournamentService(
  new PrismaTournamentRepository(),
);

export default async function TournamentBracketPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;

  let bracket;
  try {
    bracket = await tournamentService.getBracket(id);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }

    throw error;
  }

  return (
    <main>
      <h1>{bracket.tournament.name}</h1>
      {bracket.rounds.length > 0 ? (
        <Bracket rounds={bracket.rounds} />
      ) : (
        <p>Le tableau n’a pas encore été généré.</p>
      )}
    </main>
  );
}
