import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/server/auth/auth-options";

import { CreateTournamentForm } from "./tournament-form";

export default async function AdminTournamentsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== Role.ADMIN) {
    redirect("/");
  }

  return (
    <main>
      <h1>Créer un tournoi</h1>
      <p>
        Les tournois sont créés en préparation et peuvent être activés plus
        tard.
      </p>
      <p>
        <Link href="/admin/disputes">Arbitrer les résultats en attente</Link>
      </p>
      <p>
        <Link href="/admin/corrections">Corriger un résultat validé</Link>
      </p>
      <p>
        <Link href="/admin/audit">Consulter le journal d’audit</Link>
      </p>
      <CreateTournamentForm />
    </main>
  );
}
