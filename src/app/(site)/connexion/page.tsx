import type { Metadata } from "next";

import { LoginForm } from "./login-form";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Connexion | TdT",
  description: "Connexion à l'application TdT",
};

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1>Connexion à TdT</h1>
        <p>Connectez-vous pour retrouver vos matchs et les tournois du club.</p>
        <LoginForm />
      </section>
    </main>
  );
}
