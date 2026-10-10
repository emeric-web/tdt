import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/server/auth/auth-options";

import { CreateMemberForm } from "./user-form";

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/connexion");
  }

  if (session.user.role !== Role.ADMIN) {
    redirect("/");
  }

  return (
    <main>
      <h1>Créer un compte membre</h1>
      <p>Seuls les administrateurs peuvent créer des comptes.</p>
      <CreateMemberForm />
      <Link href="/admin">
        Annuler
      </Link>
    </main>
  );
}
