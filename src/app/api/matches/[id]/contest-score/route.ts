import { Role } from "@/generated/prisma/enums";
import { requireUserWithRole } from "@/server/auth/authorization";
import { BadRequestError } from "@/server/errors/app-error";
import { handleError } from "@/server/errors/handle-error";
import { PrismaMatchRepository } from "@/server/matches/match.repository";
import { MatchService } from "@/server/matches/match.service";

const matchService = new MatchService(new PrismaMatchRepository());

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  request: Request,
  { params }: RouteContext,
): Promise<Response> {
  try {
    const user = await requireUserWithRole([Role.MEMBER]);
    const { id } = await params;

    let input: unknown;

    try {
      input = await request.json();
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new BadRequestError();
      }

      throw error;
    }

    return Response.json(await matchService.contestScore(id, user.id, input));
  } catch (error) {
    return handleError(error);
  }
}
