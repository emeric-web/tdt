import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import Link from "next/link";

import { authOptions } from "@/server/auth/auth-options";
import { PrismaMatchRepository } from "@/server/matches/match.repository";

import { TournamentsList } from "../(home)/tournamentsList/tournaments-list";

import style from "./page.module.css";

const matchRepository = new PrismaMatchRepository();

export default async function Admin() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/connexion");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  const disputedMatches = await matchRepository.listForArbitration();

  return (
    <main className={style.admin}>
      <div className={style.intro}>
        <p className={style.eyebrow}>TdT · Administration</p>
        <h1>Bonjour, {session.user.name} 👋</h1>
        <p>Retrouvez ce qui demande votre attention et les tournois du club.</p>
      </div>

      <div className={style.dashboard}>
        <section aria-labelledby="to-handle-heading">
          <h2 className={style.sectionTitle} id="to-handle-heading">
            À traiter
          </h2>
          <div className={style.actionGrid}>
            <Link className={style.actionCard} href="/admin/litiges">
              <span className={style.actionIcon} aria-hidden="true">
                !
              </span>
              <span className={style.cardCopy}>
                <strong>Litiges</strong>
                <small>
                  {disputedMatches.length}{" "}
                  {disputedMatches.length > 1 ? "matchs" : "match"} à arbitrer
                </small>
              </span>
              <span className={style.arrow} aria-hidden="true">
                ›
              </span>
            </Link>
            <Link
              className={style.actionCard}
              href="/admin/matchs-a-plannifier"
            >
              <span className={style.actionIcon} aria-hidden="true">
                ◷
              </span>
              <span className={style.cardCopy}>
                <strong>Matchs à planifier</strong>
                <small>Fixer les horaires et les courts</small>
              </span>
              <span className={style.arrow} aria-hidden="true">
                ›
              </span>
            </Link>
          </div>
        </section>

        <TournamentsList status="IN_PROGRESS" heading="Tournois en cours" />
        <TournamentsList
          status="DRAFT"
          heading="Tournois en cours de création"
        />

        <Link className={style.createButton} href="/admin/tournoi/nouveau">
          Créer un nouveau tournoi
        </Link>
        <Link className={style.createButton} href="/admin/membres/nouveau">
          Créer un compte membre
        </Link>

        <section aria-labelledby="others-heading">
          <h2 className={style.sectionTitle} id="others-heading">
            Autres
          </h2>
          <div className={style.actionGrid}>
            <Link className={style.actionCard} href="/admin/audit">
              <span className={style.actionIcon} aria-hidden="true">
                ≡
              </span>
              <span className={style.cardCopy}>
                <strong>Journal d’audit</strong>
                <small>Consulter les actions effectuées</small>
              </span>
              <span className={style.arrow} aria-hidden="true">
                ›
              </span>
            </Link>
            <Link className={style.actionCard} href="/admin/corrections">
              <span className={style.actionIcon} aria-hidden="true">
                ✎
              </span>
              <span className={style.cardCopy}>
                <strong>Corrections</strong>
                <small>Corriger un résultat validé</small>
              </span>
              <span className={style.arrow} aria-hidden="true">
                ›
              </span>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
