import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { SignOutBtn } from "@/app/(site)/_components/auth/sign-out-btn";
import { AnonymizeAccountButton } from "@/app/(site)/_components/auth/anonymize-account";

import { authOptions } from "@/server/auth/auth-options";

//import styles from "./page.module.css";

export default async function Profile() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/connexion");
  }

  const user = session.user;
  const isAdmin = user?.role === "ADMIN";

  return (
    <main>
      <p>{user?.name}</p>
      <p>{user?.email}</p>
      {!isAdmin && <AnonymizeAccountButton />}
      <SignOutBtn />
    </main>
  );
}
