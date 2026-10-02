import { Role } from "@/generated/prisma/enums";
import { requireUserWithRole } from "@/server/auth/authorization";
import { handleError } from "@/server/errors/handle-error";
import { PrismaMatchRepository } from "@/server/matches/match.repository";
import { MatchService } from "@/server/matches/match.service";

const matchService = new MatchService(new PrismaMatchRepository());

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  _request: Request,
  { params }: RouteContext,
): Promise<Response> {
  try {
    const user = await requireUserWithRole([Role.MEMBER]);
    const { id } = await params;

    return Response.json(await matchService.confirm(id, user.id));
  } catch (error) {
    return handleError(error);
  }
}
