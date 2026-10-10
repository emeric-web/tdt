import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/server/auth/auth-options";
import { PrismaMatchRepository } from "@/server/matches/match.repository";

import { ScheduleQueue } from "./schedule-queue";

const matchRepository = new PrismaMatchRepository();

export default async function AdminMatchsAPlannifierPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/connexion");
  }

  if (session.user.role !== Role.ADMIN) {
    redirect("/");
  }

  const matches = await matchRepository.listToSchedule();

  return (
    <main>
      <h1>Matchs à planifier</h1>
      <p>Indiquez la date, l’heure et le court de chaque match.</p>
      <p>
        <Link href="/admin">Retour</Link>
      </p>
      <ScheduleQueue matches={matches} />
    </main>
  );
}
