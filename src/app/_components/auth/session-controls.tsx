"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

// Shows the signed-in user and sign-out action, or a sign-in link when anonymous.
export function SessionControls() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <p aria-live="polite">Chargement de la session…</p>;
  }

  if (!session) {
    return <Link href="/login">Se connecter</Link>;
  }

  return (
    <div>
      <p>
        Connecté en tant que {session.user.name} ({session.user.role}).
      </p>
      {session.user.role === "ADMIN" && (
        <Link href="/admin/users">Gérer les membres</Link>
      )}
      <button type="button" onClick={() => signOut({ callbackUrl: "/login" })}>
        Se déconnecter
      </button>
    </div>
  );
}
