import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/server/auth/auth-options";
import { PrismaMatchRepository } from "@/server/matches/match.repository";

import { ArbitrationQueue } from "./arbitration-queue";

const matchRepository = new PrismaMatchRepository();

export default async function AdminDisputesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== Role.ADMIN) {
    redirect("/");
  }

  const matches = await matchRepository.listForArbitration();

  return (
    <main>
      <h1>Arbitrer les résultats</h1>
      <p>
        L’arbitrage valide le score et le vainqueur. Le vainqueur avance dans le
        tableau dans la même transaction.
      </p>
      <p>
        <Link href="/admin/tournaments">Retour à l’administration</Link>
      </p>
      <ArbitrationQueue matches={matches} />
    </main>
  );
}
