import "dotenv/config";

import { execFileSync } from "node:child_process";

const databaseUrl = process.env.E2E_DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "Set E2E_DATABASE_URL to a dedicated PostgreSQL database ending in _e2e.",
  );
}

const databaseName = new URL(databaseUrl).pathname.slice(1);

if (!databaseName.endsWith("_e2e")) {
  throw new Error("E2E_DATABASE_URL database name must end in _e2e.");
}

const environment = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  E2E_DATABASE_URL: databaseUrl,
};
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

execFileSync(npm, ["exec", "--", "prisma", "migrate", "deploy"], {
  env: environment,
  stdio: "inherit",
});
execFileSync(npm, ["exec", "--", "playwright", "test"], {
  env: environment,
  stdio: "inherit",
});
