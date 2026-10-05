import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/server/auth/auth-options";
import { PrismaAuditRepository } from "@/server/audit/audit.repository";
import { AuditService } from "@/server/audit/audit.service";
import { prisma } from "@/server/db/prisma";

type PageProps = {
  searchParams: Promise<{ tournamentId?: string; page?: string }>;
};

const auditService = new AuditService(new PrismaAuditRepository());

export default async function AdminAuditPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== Role.ADMIN) {
    redirect("/");
  }

  const [{ tournamentId, page }, tournaments] = await Promise.all([
    searchParams,
    prisma.tournament.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const audit = tournamentId
    ? await auditService.list({ tournamentId, page })
    : null;

  return (
    <main>
      <h1>Journal d’audit</h1>
      <p>
        <Link href="/admin/disputes">Retour aux arbitrages</Link>
      </p>
      <form method="get">
        <label>
          Tournoi
          <select
            name="tournamentId"
            defaultValue={tournamentId ?? ""}
            required
          >
            <option value="">Sélectionner un tournoi</option>
            {tournaments.map((tournament) => (
              <option key={tournament.id} value={tournament.id}>
                {tournament.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Afficher le journal</button>
      </form>
      {audit && (
        <>
          <h2>Décisions et opérations ({audit.total})</h2>
          {audit.items.length === 0 ? (
            <p>Aucune entrée pour ce tournoi.</p>
          ) : (
            <ol>
              {audit.items.map((entry) => (
                <li key={entry.id}>
                  <h3>
                    {entry.action} — {entry.entity} {entry.entityId}
                  </h3>
                  <p>
                    {new Date(entry.createdAt).toLocaleString("fr-FR")} · auteur
                    : {entry.actorId}
                  </p>
                  {entry.reason && <p>Motif : {entry.reason}</p>}
                  <details>
                    <summary>Valeurs avant et après</summary>
                    <h4>Avant</h4>
                    <pre>{JSON.stringify(entry.before, null, 2)}</pre>
                    <h4>Après</h4>
                    <pre>{JSON.stringify(entry.after, null, 2)}</pre>
                  </details>
                </li>
              ))}
            </ol>
          )}
          <nav aria-label="Pagination du journal">
            {audit.page > 1 && (
              <a
                href={`/admin/audit?tournamentId=${encodeURIComponent(tournamentId ?? "")}&page=${audit.page - 1}`}
              >
                Page précédente
              </a>
            )}
            {audit.page * audit.pageSize < audit.total && (
              <a
                href={`/admin/audit?tournamentId=${encodeURIComponent(tournamentId ?? "")}&page=${audit.page + 1}`}
              >
                Page suivante
              </a>
            )}
          </nav>
        </>
      )}
    </main>
  );
}
