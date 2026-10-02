import { Role } from "@/generated/prisma/enums";
import { requireUserWithRole } from "@/server/auth/authorization";
import { handleError } from "@/server/errors/handle-error";
import { PrismaMatchRepository } from "@/server/matches/match.repository";
import { MatchService } from "@/server/matches/match.service";

const matchService = new MatchService(new PrismaMatchRepository());

export async function GET(): Promise<Response> {
  try {
    const user = await requireUserWithRole([Role.MEMBER]);

    return Response.json(await matchService.listUpcomingForPlayer(user.id));
  } catch (error) {
    return handleError(error);
  }
}
