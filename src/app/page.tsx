import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/server/auth/auth-options";

import { SessionControls } from "@/components/auth/session-controls";
import { TournamentDashboard } from "@/components/tournaments/tournament-dashboard";

import style from "./page.module.css";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main>
      <div className={style.page}>
        <div className={style.intro}>
          <h1>Tournois TdT</h1>
          <p>Bienvenue, {session.user.name}.</p>
        </div>
        <div className={style.main}>
          <SessionControls />
          <TournamentDashboard
            isAdmin={session.user.role === "ADMIN"}
            currentUserId={
              session.user.role === "MEMBER" ? session.user.id : undefined
            }
          />
        </div>
      </div>
    </main>
  );
}
