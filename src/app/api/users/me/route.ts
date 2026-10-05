import bcrypt from "bcryptjs";
import { Role } from "@/generated/prisma/enums";
import { requireUserWithRole } from "@/server/auth/authorization";
import { handleError } from "@/server/errors/handle-error";
import { PrismaUserRepository } from "@/server/users/user.repository";
import { UserService } from "@/server/users/user.service";

const userService = new UserService(new PrismaUserRepository(), (password) =>
  bcrypt.hash(password, 12),
);

export async function DELETE(): Promise<Response> {
  try {
    const member = await requireUserWithRole([Role.MEMBER]);
    await userService.anonymizeMember(member.id);

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleError(error);
  }
}
