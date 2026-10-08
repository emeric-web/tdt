import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/app/legal-pages.module.css";

export const metadata: Metadata = {
  title: "Politique de confidentialité | TdT",
  description:
    "Informations sur les données personnelles traitées par l’application TdT.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className={styles.page}>
      <h1>Politique de confidentialité</h1>
      <p>
        Cette page décrit les données traitées par TdT pour gérer les comptes
        membres et les tournois. Les champs signalés « À compléter » doivent
        être renseignés par l’éditeur avant la mise en ligne publique.
      </p>

      <section aria-labelledby="controller">
        <h2 id="controller">Responsable du traitement</h2>
        <p className={styles.placeholder}>
          <strong>À compléter :</strong> identité et coordonnées du responsable
          du traitement, ainsi que l’adresse de contact pour les demandes
          relatives aux données personnelles.
        </p>
      </section>

      <section aria-labelledby="data">
        <h2 id="data">Données traitées</h2>
        <ul>
          <li>
            Compte : nom, adresse e-mail, rôle et empreinte cryptographique du
            mot de passe. Le mot de passe en clair n’est pas enregistré.
          </li>
          <li>
            Activité sportive : inscriptions aux tournois, têtes de série,
            rencontres, résultats et progression dans le tableau.
          </li>
          <li>
            Traçabilité : identifiant de l’auteur, date, action, motif et
            éléments avant/après pour certaines opérations d’administration et
            décisions d’arbitrage.
          </li>
          <li>
            Session : un cookie technique est utilisé pour maintenir la
            connexion. L’application n’emploie pas de cookie publicitaire ni
            d’outil de mesure d’audience dans son fonctionnement actuel.
          </li>
        </ul>
      </section>

      <section aria-labelledby="purposes">
        <h2 id="purposes">Finalités</h2>
        <p>
          Ces données servent à créer et sécuriser les comptes, gérer les
          inscriptions et les tournois, afficher les matchs et leurs résultats,
          traiter les contestations et conserver la traçabilité des décisions
          administratives.
        </p>
        <p className={styles.placeholder}>
          <strong>À confirmer par le responsable du traitement :</strong> bases
          légales retenues pour chacune de ces finalités.
        </p>
      </section>

      <section aria-labelledby="access">
        <h2 id="access">Destinataires et prestataires</h2>
        <p>
          Les données sont accessibles aux personnes habilitées à administrer le
          service, dans la mesure nécessaire à leurs fonctions. Les informations
          de compte ne sont pas affichées dans les tableaux de matchs destinés
          aux membres.
        </p>
        <p className={styles.placeholder}>
          <strong>À compléter :</strong> hébergeur, prestataire de base de
          données et tout autre sous-traitant ayant accès aux données ; préciser
          également si des données sont transférées hors de l’Espace économique
          européen et, le cas échéant, les garanties appliquées.
        </p>
      </section>

      <section aria-labelledby="retention">
        <h2 id="retention">Durée de conservation</h2>
        <p className={styles.placeholder}>
          <strong>À définir :</strong> durée de conservation des comptes
          inactifs, des données de tournois et des journaux d’audit, ainsi que
          les critères de calcul de ces durées.
        </p>
        <p>
          Lorsqu’un membre demande l’anonymisation de son compte, son nom est
          remplacé par « Joueur supprimé », son adresse e-mail par une adresse
          technique et son empreinte de mot de passe est supprimée.
          L’identifiant interne est conservé pour préserver la cohérence des
          résultats et des journaux historiques. Cette opération ne supprime
          donc pas les résultats ni les références historiques associés à cet
          identifiant.
        </p>
      </section>

      <section aria-labelledby="rights">
        <h2 id="rights">Droits des personnes</h2>
        <p>
          Sous réserve des conditions et limites prévues par la réglementation,
          vous pouvez demander l’accès à vos données, leur rectification, leur
          effacement, la limitation de leur traitement, la portabilité lorsque
          ce droit s’applique, ou vous opposer à certains traitements. Vous
          pouvez également retirer votre consentement lorsque le traitement
          repose sur celui-ci et introduire une réclamation auprès de l’autorité
          de contrôle compétente (en France, la CNIL).
        </p>
        <p className={styles.placeholder}>
          <strong>À compléter :</strong> adresse de contact pour exercer ces
          droits.
        </p>
      </section>

      <section aria-labelledby="security">
        <h2 id="security">Sécurité</h2>
        <p>
          L’application limite l’accès aux fonctionnalités selon le rôle du
          compte et ne renvoie pas les empreintes de mot de passe dans ses
          réponses publiques. Le responsable du traitement doit compléter ces
          informations avec les mesures organisationnelles et techniques
          effectivement déployées pour l’environnement hébergé.
        </p>
      </section>

      <p>
        Pour les informations sur l’éditeur et l’hébergeur, consultez les{" "}
        <Link href="/mentions-legales">mentions légales</Link>.
      </p>
      <Link className={styles.backLink} href="/">
        Retour à l’accueil
      </Link>
    </main>
  );
}
