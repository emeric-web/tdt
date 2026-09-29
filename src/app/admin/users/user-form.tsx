"use client";

import { useState, type FormEvent } from "react";

type ApiErrorResponse = {
  error?: {
    message?: string;
  };
};

type CreatedMember = {
  name: string;
  email: string;
};

function isApiErrorResponse(result: unknown): result is ApiErrorResponse {
  return (
    typeof result === "object" &&
    result !== null &&
    "error" in result &&
    typeof result.error === "object" &&
    result.error !== null
  );
}

function isCreatedMember(result: unknown): result is CreatedMember {
  return (
    typeof result === "object" &&
    result !== null &&
    "name" in result &&
    typeof result.name === "string" &&
    "email" in result &&
    typeof result.email === "string"
  );
}

export function CreateMemberForm() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          temporaryPassword: formData.get("temporaryPassword"),
        }),
      });
      const result: unknown = await response.json();

      if (!response.ok) {
        setErrorMessage(
          isApiErrorResponse(result) &&
            typeof result.error?.message === "string"
            ? result.error.message
            : "Impossible de créer le compte.",
        );
        return;
      }

      if (!isCreatedMember(result)) {
        throw new Error("The create-user response has an invalid shape.");
      }

      const createdMember = result;
      setSuccessMessage(
        `Le compte de ${createdMember.name} (${createdMember.email}) a été créé.`,
      );
      form.reset();
    } catch (error) {
      console.error("Unable to create member account.", error);
      setErrorMessage("Impossible de contacter le serveur. Réessayez.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Nom
        <input
          name="name"
          autoComplete="name"
          minLength={1}
          maxLength={100}
          required
          disabled={isSubmitting}
        />
      </label>
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
        Mot de passe provisoire
        <input
          type="password"
          name="temporaryPassword"
          autoComplete="new-password"
          minLength={9}
          maxLength={72}
          required
          disabled={isSubmitting}
        />
      </label>
      {errorMessage && <p role="alert">{errorMessage}</p>}
      {successMessage && <p role="status">{successMessage}</p>}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Création…" : "Créer le compte"}
      </button>
    </form>
  );
}
