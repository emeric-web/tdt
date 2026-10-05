import type { AuditPage } from "@/server/audit/audit.repository";
import { PrismaAuditRepository } from "@/server/audit/audit.repository";
import { listAuditSchema } from "@/server/audit/audit.schemas";

export class AuditService {
  constructor(private readonly repository: PrismaAuditRepository) {}

  list(input: unknown): Promise<AuditPage> {
    const query = listAuditSchema.parse(input);
    return this.repository.list(query);
  }
}
