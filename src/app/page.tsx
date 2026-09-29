import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/server/auth/auth-options";
import { SessionControls } from "./_components/auth/session-controls";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main>
      <h1>Gestion de tournois TdT</h1>
      <p>Bienvenue, {session.user.name}.</p>
      <SessionControls />
    </main>
  );
}
