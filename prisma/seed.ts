import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} must be set before seeding the database.`);
  }

  return value;
}

const seedPassword = requireEnvironmentVariable("SEED_PASSWORD");
const databaseUrl = requireEnvironmentVariable("DATABASE_URL");
const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

const demoUsers = [
  {
    id: "demo-admin",
    name: "Administrateur TdT",
    email: "admin@tdt.local",
    role: "ADMIN" as const,
  },
  ...Array.from({ length: 11 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");

    return {
      id: `demo-member-${number}`,
      name: `Joueur ${number}`,
      email: `joueur${number}@tdt.local`,
      role: "MEMBER" as const,
    };
  }),
];

async function main() {
  const passwordHash = await bcrypt.hash(seedPassword, 12);

  await prisma.$transaction(async (transaction) => {
    const seededUsers = await Promise.all(
      demoUsers.map((user) =>
        transaction.user.upsert({
          where: { email: user.email },
          update: {
            name: user.name,
            passwordHash,
            role: user.role,
            anonymized: false,
          },
          create: {
            ...user,
            passwordHash,
          },
        }),
      ),
    );

    const tournament = await transaction.tournament.upsert({
      where: { id: "demo-tournament-2026" },
      update: {},
      create: {
        id: "demo-tournament-2026",
        name: "Tournoi de démonstration 2026",
        status: "DRAFT",
        finalSetSuperTiebreak: false,
      },
    });

    for (let index = 1; index < seededUsers.length; index += 1) {
      const user = seededUsers[index];

      await transaction.participant.upsert({
        where: {
          tournamentId_userId: {
            tournamentId: tournament.id,
            userId: user.id,
          },
        },
        update: {
          seed: index === 1 ? 1 : index === 2 ? 2 : null,
        },
        create: {
          tournamentId: tournament.id,
          userId: user.id,
          seed: index === 1 ? 1 : index === 2 ? 2 : null,
        },
      });
    }
  });
  console.info("Seeded 1 admin, 11 members and 1 draft tournament.");
}

main()
  .catch((error: unknown) => {
    console.error("Database seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
