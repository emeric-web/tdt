"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

import styles from "./app-header.module.css";

export function AppHeader() {
  const { data: session, status } = useSession();
  const user = session?.user;
  const isAdmin = user?.role === "ADMIN";
  const pathname = usePathname();
  const isAdminArea =
    isAdmin &&
    pathname.startsWith("/admin");
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
    <header className={`${styles.header} ${isAdminArea ? styles.admin : ""}`}>
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
              {isAdmin &&
                <Link
                  href="/admin"
                  prefetch={false}
                >
                  <span className={styles.adminBadge}>ADMIN</span>
                </Link>
              }
              <Link
                className={styles.avatar}
                href="/profil"
                aria-label="TdT, profil"
                prefetch={false}
              >
                {initials}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
