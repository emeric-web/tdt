import Link from "next/link";

import styles from "./app-footer.module.css";

export function AppFooter() {
  return (
    <footer className={styles.footer}>
      <nav aria-label="Informations légales">
        <Link href="/mentions-legales">Mentions légales</Link>
        <Link href="/politique-confidentialite">
          Politique de confidentialité
        </Link>
      </nav>
    </footer>
  );
}
