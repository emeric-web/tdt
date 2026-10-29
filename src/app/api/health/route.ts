import { prisma } from "@/server/db/prisma";

const headers = { "Cache-Control": "no-store" };

// Route publique : aucune authentification, aucun détail renvoyé.
export async function GET(): Promise<Response> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" }, { headers });
  } catch (error) {
    console.error("Health check failed: database unreachable", error);
    return Response.json({ status: "error" }, { status: 503, headers });
  }
}
