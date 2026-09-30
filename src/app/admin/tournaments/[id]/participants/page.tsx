import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/server/auth/auth-options";

import { ManageParticipants } from "./participants";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TournamentParticipantsPage({
  params,
}: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== Role.ADMIN) {
    redirect("/");
  }

  const { id } = await params;

  return (
    <main>
      <h1>Gérer les inscriptions</h1>
      <ManageParticipants tournamentId={id} />
    </main>
  );
}
