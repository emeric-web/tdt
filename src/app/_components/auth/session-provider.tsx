"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

// Makes Auth.js session state available to client components across the app.
export function AuthSessionProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
