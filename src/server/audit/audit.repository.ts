import type { AuditLog } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import type { ListAuditInput } from "@/server/audit/audit.schemas";

export type AuditEntry = Pick<
  AuditLog,
  | "id"
  | "tournamentId"
  | "actorId"
  | "action"
  | "reason"
  | "entity"
  | "entityId"
  | "before"
  | "after"
> & {
  createdAt: string;
};

export type AuditPage = {
  items: AuditEntry[];
  page: number;
  pageSize: number;
  total: number;
};

export class PrismaAuditRepository {
  async list(query: ListAuditInput): Promise<AuditPage> {
    const where = { tournamentId: query.tournamentId };
    const [entries, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      items: entries.map((entry) => ({
        id: entry.id,
        tournamentId: entry.tournamentId,
        actorId: entry.actorId,
        action: entry.action,
        reason: entry.reason,
        entity: entry.entity,
        entityId: entry.entityId,
        before: entry.before,
        after: entry.after,
        createdAt: entry.createdAt.toISOString(),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }
}
