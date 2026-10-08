"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function LoginForm() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      callbackUrl: "/",
      redirect: false,
    }).catch((error: unknown) => {
      console.error("Unable to sign in.", error);
      return null;
    });

    setIsSubmitting(false);

    if (!result || result.error) {
      setErrorMessage("Adresse e-mail ou mot de passe invalide.");
      return;
    }

    router.replace(result.url ?? "/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Adresse e-mail
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          disabled={isSubmitting}
        />
      </label>
      <label>
        Mot de passe
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          disabled={isSubmitting}
        />
      </label>
      {errorMessage && <p role="alert">{errorMessage}</p>}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
