"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";

import styles from "./app-header.module.css";
import { AnonymizeAccountButton } from "@/app/(site)/_components/auth/anonymize-account";

export function AppHeader() {
  const { data: session, status } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const user = session?.user;
  const isAdmin = user?.role === "ADMIN";
  const userName = user?.name ?? user?.email ?? "Mon compte";
  const initials =
    userName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((name) => name[0])
      .join("")
      .toLocaleUpperCase("fr") ?? "?";

  return (
    <header className={`${styles.header} ${isAdmin ? styles.admin : ""}`}>
      <div className={styles.inner}>
        <Link
          className={styles.brand}
          href="/"
          aria-label="TdT, accueil"
          prefetch={false}
        >
          <span className={styles.brandMark} aria-hidden="true">
            TdT
          </span>
          <span className={styles.brandName}>Tennis Club la Bérengère</span>
        </Link>
        <div className={styles.account}>
          {status === "loading" ? (
            <span className={styles.sessionStatus} aria-live="polite">
              Chargement…
            </span>
          ) : user && (
            <>
              {isAdmin && <span className={styles.adminBadge}>ADMIN</span>}
              <Link
                className={styles.avatar}
                href="/profil"
                aria-label="TdT, profil"
                prefetch={false}
              >
                {initials}
              </Link>
              {/* 
              {isMenuOpen && (
                <nav
                  className={styles.menu}
                  id="account-menu"
                  aria-label="Menu du compte"
                >
                  <p className={styles.accountName}>{userName}</p>
                  {isAdmin && (
                    <>
                      <Link
                        href="/admin/disputes"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Arbitrer les résultats
                      </Link>
                      <Link
                        href="/admin/tournaments"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Créer un tournoi
                      </Link>
                      <Link
                        href="/admin/users"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Gérer les membres
                      </Link>
                      <Link
                        href="/admin/audit"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Journal d’audit
                      </Link>
                    </>
                  )}
                </nav>
              )}
              */}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
