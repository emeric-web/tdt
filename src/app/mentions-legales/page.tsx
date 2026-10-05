import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/app/legal-pages.module.css";

export const metadata: Metadata = {
  title: "Mentions légales | TdT",
  description: "Mentions légales de l’application TdT.",
};

export default function LegalNoticePage() {
  return (
    <main className={styles.page}>
      <h1>Mentions légales</h1>
      <p>
        Les informations ci-dessous doivent être complétées par l’éditeur avant
        la mise en ligne publique du service.
      </p>

      <section aria-labelledby="publisher">
        <h2 id="publisher">Éditeur du site</h2>
        <p className={styles.placeholder}>
          <strong>À compléter :</strong> nom ou raison sociale de l’éditeur,
          forme juridique, adresse postale, numéro d’immatriculation le cas
          échéant et adresse e-mail de contact.
        </p>
      </section>

      <section aria-labelledby="publication">
        <h2 id="publication">Directeur ou directrice de la publication</h2>
        <p className={styles.placeholder}>
          <strong>À compléter :</strong> nom de la personne responsable de la
          publication.
        </p>
      </section>

      <section aria-labelledby="hosting">
        <h2 id="hosting">Hébergement</h2>
        <p className={styles.placeholder}>
          <strong>À compléter :</strong> raison sociale et coordonnées de
          l’hébergeur, adresse postale et numéro de téléphone.
        </p>
      </section>

      <section aria-labelledby="contact">
        <h2 id="contact">Contact</h2>
        <p>
          Pour toute question au sujet du site, contactez son éditeur à
          l’adresse qui sera renseignée dans cette page.
        </p>
      </section>

      <Link className={styles.backLink} href="/">
        Retour à l’accueil
      </Link>
    </main>
  );
}
