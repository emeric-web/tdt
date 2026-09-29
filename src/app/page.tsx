import { SessionControls } from "./_components/auth/session-controls";

export default function Home() {
  return (
    <main>
      <h1>Gestion de tournois TdT</h1>
      <p>Connectez-vous pour accéder aux fonctionnalités de votre compte.</p>
      <SessionControls />
    </main>
  );
}
