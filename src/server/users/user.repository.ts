import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { User } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import { ConflictError } from "@/server/errors/app-error";

export type PublicUser = Pick<User, "id" | "name" | "email" | "role">;

export type CreateMemberData = Pick<User, "name" | "email" | "passwordHash">;

export interface UserRepository {
  createMember(data: CreateMemberData): Promise<PublicUser>;
}

export class PrismaUserRepository implements UserRepository {
  async createMember(data: CreateMemberData): Promise<PublicUser> {
    try {
      return await prisma.user.create({
        data: {
          ...data,
          role: "MEMBER",
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictError("Cette adresse e-mail est déjà utilisée.");
      }

      throw error;
    }
  }
}
