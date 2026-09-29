import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Connexion | TdT",
  description: "Connexion à l'application TdT",
};

export default function LoginPage() {
  return (
    <main>
      <h1>Connexion à TdT</h1>
      <p>Connectez-vous avec votre adresse e-mail et votre mot de passe.</p>
      <LoginForm />
    </main>
  );
}
