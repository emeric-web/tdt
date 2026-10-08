import type { Metadata } from "next";
import "./_styles/globals.css";

import { AuthSessionProvider } from "@/app/(site)/_components/auth/session-provider";
import { AppHeader } from "@/app/(site)/_components/header/app-header";
import { AppFooter } from "@/app/(site)/_components/footer/app-footer";

export const metadata: Metadata = {
  title: "TdT",
  description: "Gestion de tournois de tennis en simple",
};

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
      <>
        <AuthSessionProvider>
          <AppHeader />
          {children}
          <AppFooter />
        </AuthSessionProvider>
      </>
  );
}
