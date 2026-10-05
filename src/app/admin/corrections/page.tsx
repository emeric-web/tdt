import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/server/auth/auth-options";
import { PrismaMatchRepository } from "@/server/matches/match.repository";

import { ResultCorrectionQueue } from "./result-correction";

const matchRepository = new PrismaMatchRepository();

export default async function AdminCorrectionsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== Role.ADMIN) {
    redirect("/");
  }

  const matches = await matchRepository.listForCorrection();

  return (
    <main>
      <h1>Corriger un résultat validé</h1>
      <p>
        Les corrections sont réservées aux tournois en cours. Si le vainqueur
        change, le match suivant doit être encore en attente ; son emplacement
        est remplacé dans la même transaction.
      </p>
      <p>
        <Link href="/admin/tournaments">Retour à l’administration</Link>
      </p>
      <ResultCorrectionQueue matches={matches} />
    </main>
  );
}
