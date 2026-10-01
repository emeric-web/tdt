import type { Metadata } from "next";
import "./globals.css";
import "swagger-ui-react/swagger-ui.css";

import { AuthSessionProvider } from "@/components/auth/session-provider";

export const metadata: Metadata = {
  title: "TdT",
  description: "Gestion de tournois de tennis en simple",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr">
      <body>
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
