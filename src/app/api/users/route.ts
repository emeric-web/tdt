import bcrypt from "bcryptjs";
import { Role } from "@/generated/prisma/enums";
import { requireUserWithRole } from "@/server/auth/authorization";
import { BadRequestError } from "@/server/errors/app-error";
import { handleError } from "@/server/errors/handle-error";
import { PrismaUserRepository } from "@/server/users/user.repository";
import { UserService } from "@/server/users/user.service";

const userService = new UserService(new PrismaUserRepository(), (password) =>
  bcrypt.hash(password, 12),
);

export async function POST(request: Request): Promise<Response> {
  try {
    await requireUserWithRole([Role.ADMIN]);

    let input: unknown;

    try {
      input = await request.json();
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new BadRequestError();
      }

      throw error;
    }

    const member = await userService.createMember(input);

    return Response.json(member, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    await requireUserWithRole([Role.ADMIN]);
    const query = Object.fromEntries(new URL(request.url).searchParams);

    return Response.json(await userService.listMembers(query));
  } catch (error) {
    return handleError(error);
  }
}
