import { Role } from "@/generated/prisma/enums";
import { requireUserWithRole } from "@/server/auth/authorization";
import { handleError } from "@/server/errors/handle-error";
import { AuditService } from "@/server/audit/audit.service";
import { PrismaAuditRepository } from "@/server/audit/audit.repository";

const auditService = new AuditService(new PrismaAuditRepository());

export async function GET(request: Request): Promise<Response> {
  try {
    await requireUserWithRole([Role.ADMIN]);
    const url = new URL(request.url);
    const query = Object.fromEntries(url.searchParams.entries());

    return Response.json(await auditService.list(query));
  } catch (error) {
    return handleError(error);
  }
}
