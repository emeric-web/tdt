import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { User } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import { ConflictError, NotFoundError } from "@/server/errors/app-error";

export type PublicUser = Pick<User, "id" | "name" | "email" | "role">;

export type CreateMemberData = Pick<User, "name" | "email" | "passwordHash">;

export type MemberPage = {
  items: PublicUser[];
  page: number;
  pageSize: number;
  total: number;
};

export interface UserRepository {
  createMember(data: CreateMemberData): Promise<PublicUser>;
  findMembers(input: { page: number; pageSize: number }): Promise<MemberPage>;
  anonymizeMember(userId: string): Promise<void>;
}

export class PrismaUserRepository implements UserRepository {
  async findMembers(input: {
    page: number;
    pageSize: number;
  }): Promise<MemberPage> {
    const where = { role: "MEMBER" as const, anonymized: false };
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
        orderBy: { name: "asc" },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      items,
      page: input.page,
      pageSize: input.pageSize,
      total,
    };
  }

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

  async anonymizeMember(userId: string): Promise<void> {
    const result = await prisma.user.updateMany({
      where: { id: userId, role: "MEMBER", anonymized: false },
      data: {
        name: "Joueur supprimé",
        email: `anonymized-${userId}@example.invalid`,
        passwordHash: null,
        anonymized: true,
      },
    });

    if (result.count === 0) {
      throw new NotFoundError("Compte membre introuvable.");
    }
  }
}
