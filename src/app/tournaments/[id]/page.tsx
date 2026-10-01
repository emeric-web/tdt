import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/server/auth/auth-options";
import { mockBracket, mockBracketT2 } from "@/mocks/bracket";
import { Bracket } from "@/components/bracket/Bracket";

type PageProps = {
  params: Promise<{ id: string }>;
};

// Temporary lookup used while the mock data replaces the real API. Remove once
// GET /api/tournaments/{id}/bracket is wired in.
const MOCK_BRACKETS_BY_ID = {
  [mockBracket.tournament.id]: mockBracket,
  [mockBracketT2.tournament.id]: mockBracketT2,
};

export default async function TournamentBracketPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;

  // TODO: remplacer par un appel à GET /api/tournaments/{id}/bracket une fois la route disponible.
  const bracket = MOCK_BRACKETS_BY_ID[id] ?? mockBracket;

  return (
    <main>
      <h1>{bracket.tournament.name}</h1>
      <Bracket rounds={bracket.rounds} />
    </main>
  );
}
