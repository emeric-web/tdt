import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/server/auth/auth-options";

import { MatchsList } from "./matchsList/matchs-list";
import { TournamentsList } from "./tournamentsList/tournaments-list";

import style from "./page.module.css";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/connexion");
  }

  return (
    <main>
      <div className={style.intro}>
        <p className={style.eyebrow}>
          TdT · Saison 2026
        </p>
        <h1>Bonjour, {session.user.name} 👋</h1>
        <p>
          Retrouvez vos prochains matchs et les tournois du club.
        </p>
      </div>
      <MatchsList currentUserId={session.user.role === "MEMBER" ? session.user.id : undefined} />
      <TournamentsList status="IN_PROGRESS" heading="Tournois en cours" />
    </main>
  );
}
