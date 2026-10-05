import "server-only";

import { prisma } from "@/server/db/prisma";

export type CredentialUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string | null;
  role: "ADMIN" | "MEMBER";
  anonymized: boolean;
};

export interface AuthRepository {
  findCredentialUserByEmail(email: string): Promise<CredentialUser | null>;
}

export class PrismaAuthRepository implements AuthRepository {
  findCredentialUserByEmail(email: string): Promise<CredentialUser | null> {
    return prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
        role: true,
        anonymized: true,
      },
    });
  }
}
