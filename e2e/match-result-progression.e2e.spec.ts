import "dotenv/config";

import bcrypt from "bcryptjs";
import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

const databaseUrl = process.env.E2E_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("E2E_DATABASE_URL is required to run browser tests.");
}

const pool = new Pool({ connectionString: databaseUrl });
const fixtureId = `e2e-${randomUUID()}`;
const password = "e2e-test-password";
const users = [
  { id: `${fixtureId}-player-1`, name: "E2E Joueur Un" },
  { id: `${fixtureId}-player-2`, name: "E2E Joueur Deux" },
  { id: `${fixtureId}-player-3`, name: "E2E Joueur Trois" },
  { id: `${fixtureId}-player-4`, name: "E2E Joueur Quatre" },
];
const tournamentId = `${fixtureId}-tournament`;
let firstRoundMatchId = "";
let finalMatchId = "";

test.beforeAll(async () => {
  const passwordHash = await bcrypt.hash(password, 4);
  const connection = await pool.connect();

  try {
    await connection.query("BEGIN");
    for (const user of users) {
      await connection.query(
        `INSERT INTO "User"
          ("id", "name", "email", "passwordHash", "role", "anonymized", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, 'MEMBER', false, now(), now())`,
        [user.id, user.name, `${user.id}@example.test`, passwordHash],
      );
    }
    const insertedUsers = await connection.query<{
      id: string;
      passwordHash: string;
      anonymized: boolean;
    }>(
      'SELECT "id", "passwordHash", "anonymized" FROM "User" WHERE "id" = ANY($1)',
      [users.map(({ id }) => id)],
    );
    if (
      insertedUsers.rowCount !== users.length ||
      insertedUsers.rows.some(
        (user) =>
          user.anonymized || !bcrypt.compareSync(password, user.passwordHash),
      )
    ) {
      throw new Error(
        "E2E test accounts were not created with valid credentials.",
      );
    }
    await connection.query(
      `INSERT INTO "Tournament"
        ("id", "name", "status", "finalSetSuperTiebreak", "createdAt", "updatedAt")
       VALUES ($1, $2, 'IN_PROGRESS', false, now(), now())`,
      [tournamentId, `${fixtureId} E2E`],
    );

    for (const user of users) {
      await connection.query(
        `INSERT INTO "Participant"
          ("id", "tournamentId", "userId", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, now(), now())`,
        [`${fixtureId}-${user.id}`, tournamentId, user.id],
      );
    }

    finalMatchId = `${fixtureId}-final`;
    firstRoundMatchId = `${fixtureId}-semifinal-1`;
    await connection.query(
      `INSERT INTO "Match"
        ("id", "tournamentId", "round", "position", "createdAt", "updatedAt")
       VALUES ($1, $2, 2, 0, now(), now())`,
      [finalMatchId, tournamentId],
    );
    await connection.query(
      `INSERT INTO "Match"
        ("id", "tournamentId", "round", "position", "player1Id", "player2Id",
         "nextMatchId", "nextSlot", "createdAt", "updatedAt")
       VALUES ($1, $2, 1, 0, $3, $4, $5, 1, now(), now())`,
      [firstRoundMatchId, tournamentId, users[0].id, users[1].id, finalMatchId],
    );
    await connection.query(
      `INSERT INTO "Match"
        ("id", "tournamentId", "round", "position", "player1Id", "player2Id",
         "nextMatchId", "nextSlot", "createdAt", "updatedAt")
       VALUES ($1, $2, 1, 1, $3, $4, $5, 2, now(), now())`,
      [
        `${fixtureId}-semifinal-2`,
        tournamentId,
        users[2].id,
        users[3].id,
        finalMatchId,
      ],
    );
    await connection.query("COMMIT");
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
});

test.afterAll(async () => {
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    await connection.query('DELETE FROM "AuditLog" WHERE "tournamentId" = $1', [
      tournamentId,
    ]);
    await connection.query('DELETE FROM "Match" WHERE "tournamentId" = $1', [
      tournamentId,
    ]);
    await connection.query(
      'DELETE FROM "Participant" WHERE "tournamentId" = $1',
      [tournamentId],
    );
    await connection.query('DELETE FROM "Tournament" WHERE "id" = $1', [
      tournamentId,
    ]);
    await connection.query('DELETE FROM "User" WHERE "id" = ANY($1)', [
      users.map(({ id }) => id),
    ]);
    await connection.query("COMMIT");
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
});

async function signIn(
  page: import("@playwright/test").Page,
  user: (typeof users)[number],
) {
  await page.goto("/connexion");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Adresse e-mail").fill(`${user.id}@example.test`);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(
    page.getByRole("heading", { name: `Bonjour, ${user.name} 👋` }),
  ).toBeVisible();
}

test("a declared result is confirmed by the opponent and advances its winner", async ({
  page,
}) => {
  await signIn(page, users[0]);
  await page.goto(`/matches/${firstRoundMatchId}`);

  await page.getByLabel(`${users[0].name}, set 1`).fill("6");
  await page.getByLabel(`${users[1].name}, set 1`).fill("4");
  await page.getByLabel(`${users[0].name}, set 2`).fill("6");
  await page.getByLabel(`${users[1].name}, set 2`).fill("3");
  await page.getByLabel("Vainqueur").selectOption(users[0].id);
  await page.getByRole("button", { name: "Déclarer le résultat" }).click();

  await expect(
    page.getByText("En attente de confirmation", { exact: true }),
  ).toBeVisible();
  const bracketBeforeConfirmation = await page.request.get(
    `/api/tournaments/${tournamentId}/bracket`,
  );
  expect(bracketBeforeConfirmation.ok()).toBe(true);
  const bracketBefore = await bracketBeforeConfirmation.json();
  expect(bracketBefore.rounds[0].matches[0].status).toBe("DECLARED");
  expect(bracketBefore.rounds[0].matches[0].winnerId).toBeNull();
  expect(bracketBefore.rounds[1].matches[0].player1).toBeNull();
  expect(bracketBefore.rounds[1].matches[0].player2).toBeNull();

  await page.goto("/");
  await page.getByRole("link", { name: "TdT, profil" }).click();
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/connexion$/);

  await signIn(page, users[1]);
  await page.goto(`/matches/${firstRoundMatchId}`);
  await page.getByRole("button", { name: "Confirmer le résultat" }).click();

  await expect(page.getByText("Terminé", { exact: true })).toBeVisible();
  const bracketAfterConfirmation = await page.request.get(
    `/api/tournaments/${tournamentId}/bracket`,
  );
  expect(bracketAfterConfirmation.ok()).toBe(true);
  const bracketAfter = await bracketAfterConfirmation.json();
  expect(bracketAfter.rounds[0].matches[0]).toMatchObject({
    status: "VALIDATED",
    scoreStatus: "VALIDATED",
    winnerId: users[0].id,
    score: [
      { p1: 6, p2: 4 },
      { p1: 6, p2: 3 },
    ],
  });
  expect(bracketAfter.rounds[1].matches[0]).toMatchObject({
    player1: { id: users[0].id, name: users[0].name },
    player2: null,
    status: "PENDING",
  });
});
