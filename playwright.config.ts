import "dotenv/config";

import { defineConfig } from "@playwright/test";

const e2eDatabaseUrl = process.env.E2E_DATABASE_URL;

if (!e2eDatabaseUrl) {
  throw new Error(
    "E2E_DATABASE_URL must point to a dedicated PostgreSQL database ending in _e2e.",
  );
}

const e2eDatabaseName = new URL(e2eDatabaseUrl).pathname.slice(1);

if (!e2eDatabaseName.endsWith("_e2e")) {
  throw new Error("E2E_DATABASE_URL database name must end in _e2e.");
}

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.spec.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    browserName: "chromium",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/login",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL: e2eDatabaseUrl,
      NEXT_DIST_DIR: ".next-e2e",
      NEXTAUTH_URL: "http://127.0.0.1:3100",
      NEXTAUTH_SECRET: "local-only-playwright-secret-not-for-deployment",
    },
  },
});
