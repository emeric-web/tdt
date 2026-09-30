import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/server/auth/auth-options";

import { SessionControls } from "./_components/auth/session-controls";
import { TournamentDashboard } from "./_components/tournaments/tournament-dashboard";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main>
      <h1>Tournois TdT</h1>
      <p>Bienvenue, {session.user.name}.</p>
      <SessionControls />
      <TournamentDashboard />
    </main>
  );
}
