"use client";

import { signOut } from "next-auth/react";

export function SignOutBtn() {

  async function handleSignOut() {
    try {
      await signOut({ callbackUrl: "/connexion" });
    } catch (error) {
      console.error("Unable to sign out.", error);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleSignOut}
      >
        Se déconnecter
      </button>
    </div>
  );
}
