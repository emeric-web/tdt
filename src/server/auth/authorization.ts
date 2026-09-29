import { getServerSession } from "next-auth";
import type { Session } from "next-auth";

import type { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/server/auth/auth-options";
import { ForbiddenError, UnauthorizedError } from "@/server/errors/app-error";

/** Validates an existing session and, when provided, its user's role. */
export function authorizeSession(
  session: Session | null,
  allowedRoles?: readonly Role[],
): Session["user"] {
  if (!session?.user) {
    throw new UnauthorizedError();
  }

  if (allowedRoles && !allowedRoles.includes(session.user.role)) {
    throw new ForbiddenError();
  }

  return session.user;
}

/** Reads the current request's session and enforces the allowed roles. */
export async function requireUserWithRole(
  allowedRoles?: readonly Role[],
): Promise<Session["user"]> {
  const session = await getServerSession(authOptions);

  return authorizeSession(session, allowedRoles);
}
